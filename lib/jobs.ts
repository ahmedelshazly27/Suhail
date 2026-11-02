import "server-only";
import { createElement } from "react";
import { env } from "@/lib/env";
import { addDays, todayISO } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import { teams } from "@/lib/m365";
import { appToken, graph, m365Live } from "@/lib/m365/graph";
import { graphClientState } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Templated } from "@/emails/Templated";

type Log = string[];
const db = () => supabaseAdmin();

/** Due today or overdue: one personal card per person (Teams bot), with Open, Mark done and Snooze one day. */
export async function dueCards(log: Log) {
  const today = todayISO();
  const { data } = await db().from("tickets").select("id,key,title,due_on,assignee_id").is("deleted_at", null).not("status", "in", "(done,cancelled)").lte("due_on", today).not("assignee_id", "is", null);
  for (const t of data || []) {
    await teams().personal(t.assignee_id!, { title: `${t.due_on === today ? "Due today" : "Overdue"}: ${t.key}`, text: t.title, href: `/team/tickets/${t.key}`,
      actions: [{ title: "Mark done", verb: "ticket.done", data: { id: t.id } }, { title: "Snooze one day", verb: "ticket.snooze", data: { id: t.id } }] });
  }
  log.push(`due cards: ${data?.length ?? 0}`);
}

/** Stand-up prompt in Teams for everyone who has it on, on the configured days. */
export async function standupPrompt(log: Log) {
  const { data: s } = await db().from("settings").select("data").single();
  const st = (s?.data as { standup?: { enabled: boolean; days: number[] } })?.standup;
  const dow = new Date(todayISO() + "T12:00:00Z").getUTCDay();
  if (!st?.enabled || !st.days.includes(dow)) { log.push("standup: not today"); return; }
  const { data: people } = await db().from("profiles").select("id").eq("active", true).eq("standup_enabled", true);
  for (const p of people || []) await teams().personal(p.id, { title: "Stand-up", text: "Done, next and blockers. Reply here or in the dashboard.", href: "/team", actions: [{ title: "Answer", verb: "standup.open" }] });
  log.push(`standup prompts: ${people?.length ?? 0}`);
}

/** Optional daily email summary, per person (profiles.digest_email). */
export async function emailDigest(log: Log) {
  const { data: people } = await db().from("profiles").select("id,name,email,lang").eq("active", true).eq("digest_email", true);
  const week = addDays(todayISO(), 7);
  for (const p of people || []) {
    const [{ data: t }, { data: n }] = await Promise.all([
      db().from("tickets").select("key,title,due_on").eq("assignee_id", p.id).is("deleted_at", null).not("status", "in", "(done,cancelled)").lte("due_on", week).order("due_on"),
      db().from("notifications").select("title").eq("profile_id", p.id).is("read_at", null).limit(10),
    ]);
    if (!t?.length && !n?.length) continue;
    const body = [`Hi ${p.name.split(" ")[0]},`, "", ...(t?.length ? ["Due this week:", ...t.map((x) => `${x.due_on} ${x.key} ${x.title}`), ""] : []), ...(n?.length ? ["Unread:", ...n.map((x) => x.title), ""] : []), `${env.teamUrl()}/team`].join("\n");
    await sendEmail({ to: p.email, subject: "Your Suhail day", react: createElement(Templated, { lang: "en", bodyAr: body, bodyEn: body, vars: {} }) });
  }
  log.push(`digests: ${people?.length ?? 0}`);
}

/** Monday: shipped last week, due this week, sprint progress, overdue and upcoming events, to the Teams channel. */
export async function weeklyDigest(log: Log) {
  if (new Date(todayISO() + "T12:00:00Z").getUTCDay() !== 1) return;
  const today = todayISO(), week = addDays(today, 7), lastWeek = addDays(today, -7);
  const [shipped, due, overdue, sprint, events] = await Promise.all([
    db().from("tickets").select("key", { count: "exact", head: true }).eq("status", "done").gte("completed_at", lastWeek),
    db().from("tickets").select("key", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(done,cancelled)").gte("due_on", today).lte("due_on", week),
    db().from("tickets").select("key", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(done,cancelled)").lt("due_on", today),
    db().from("sprints").select("id,number").eq("status", "active").maybeSingle(),
    db().from("projects").select("name,target_date").gte("target_date", today).lte("target_date", addDays(today, 21)),
  ]);
  let progress = "";
  if (sprint.data) { const { data } = await db().from("tickets").select("status,estimate").eq("sprint_id", sprint.data.id).is("deleted_at", null); const all = (data || []).reduce((n, x) => n + (x.estimate || 0), 0), done = (data || []).filter((x) => x.status === "done").reduce((n, x) => n + (x.estimate || 0), 0); progress = `Sprint ${sprint.data.number}: ${done} of ${all} points`; }
  await teams().channel({ title: "This week at Suhail", text: progress, href: "/team",
    facts: [["Shipped last week", String(shipped.count ?? 0)], ["Due this week", String(due.count ?? 0)], ["Overdue", String(overdue.count ?? 0)], ...(events.data || []).map((e) => [e.name, e.target_date!] as [string, string])] });
  log.push("weekly digest posted");
}

/** "Not now" applications older than the retention setting are soft-deleted; their CVs are removed. Orphan uploads go too. */
export async function retention(log: Log) {
  const { data: s } = await db().from("settings").select("data").single();
  const months = Number((s?.data as { retention_not_now_months?: number })?.retention_not_now_months ?? 6);
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
  const { data: old } = await db().from("applications").update({ deleted_at: new Date().toISOString(), answers: {}, cv_url: null }).eq("stage", "Not now").lt("stage_changed_at", cutoff.toISOString()).is("deleted_at", null).select("id,cv_path");
  const paths = (old || []).map((a) => a.cv_path).filter(Boolean) as string[];
  if (paths.length) await db().storage.from("cvs").remove(paths);
  // CV uploads never attached to an application within a day.
  const { data: files } = await db().storage.from("cvs").list("incoming", { limit: 1000 });
  const { data: used } = await db().from("applications").select("cv_path").not("cv_path", "is", null);
  const keep = new Set((used || []).map((u) => u.cv_path));
  const stale = (files || []).filter((f) => !keep.has(`incoming/${f.name}`) && Date.parse(f.created_at ?? "") < Date.now() - 864e5).map((f) => `incoming/${f.name}`);
  if (stale.length) await db().storage.from("cvs").remove(stale);
  log.push(`retention: ${old?.length ?? 0} applications, ${stale.length} orphan CVs`);
}

/** Graph change subscriptions expire after about three days: keep the tasks@ one alive. */
export async function renewMailSubscription(log: Log) {
  if (!m365Live() || !env.tasksMailbox()) return;
  const token = await appToken();
  const expires = new Date(Date.now() + 2.5 * 864e5).toISOString();
  const { value } = await graph<{ value: { id: string; resource: string }[] }>(token, "/subscriptions");
  const sub = value.find((s) => s.resource.includes(env.tasksMailbox()));
  if (sub) await graph(token, `/subscriptions/${sub.id}`, { method: "PATCH", body: JSON.stringify({ expirationDateTime: expires }) });
  else await graph(token, "/subscriptions", { method: "POST", body: JSON.stringify({ changeType: "created", notificationUrl: `${env.siteUrl()}/api/graph/notifications`, resource: `/users/${env.tasksMailbox()}/mailFolders('inbox')/messages`, expirationDateTime: expires, clientState: graphClientState() }) });
  log.push("tasks@ subscription renewed");
}

/** Nightly: today's value of every automatic KPI, so the plan's trend lines have history. */
export async function snapshotKpis(log: Log) {
  const { autoValues } = await import("@/lib/plan");
  const [values, { data: kpis }] = await Promise.all([autoValues(), db().from("kpis").select("id,key").eq("source", "auto")]);
  const { data: done } = await db().from("kpi_values").select("kpi_id").eq("source", "snapshot").eq("on_date", todayISO());
  const have = new Set((done || []).map((d) => d.kpi_id)); // one snapshot per KPI per day, even if the cron runs twice
  const rows = (kpis || []).filter((k) => k.key in values && !have.has(k.id)).map((k) => ({ kpi_id: k.id, value: values[k.key], on_date: todayISO(), source: "snapshot", note: "", created_by: null }));
  if (rows.length) await db().from("kpi_values").insert(rows);
  log.push(`kpi snapshot: ${rows.length}`);
}

/** The 1st of each month: each manual KPI's owner gets a card to enter this month's value. */
export async function kpiReminders(log: Log) {
  if (todayISO().slice(8) !== "01") return;
  const { data: kpis } = await db().from("kpis").select("id,name_en,unit,owner_id").eq("source", "manual").not("owner_id", "is", null);
  for (const k of kpis || []) {
    await teams().personal(k.owner_id!, {
      title: "Enter this month's value", text: k.name_en + (k.unit === "percent" ? " (%)" : k.unit === "usd" ? " (USD)" : ""), href: "/team/plan?tab=kpis",
      inputs: [{ id: "value", label: "Value", kind: "number", required: true }, { id: "note", label: "Note (optional)", kind: "text" }],
      actions: [{ title: "Save", verb: "kpi.value", data: { kpi: k.id } }],
    });
  }
  log.push(`kpi reminders: ${kpis?.length ?? 0}`);
}

/** Once, at the start of the last week of each quarter: the founder gets a "Quarterly review due" card. */
export async function reviewReminder(log: Log) {
  const today = todayISO(), y = Number(today.slice(0, 4)), q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const end = new Date(Date.UTC(y, q * 3, 0)).toISOString().slice(0, 10);
  if (addDays(end, -6) !== today) return;
  const { data: owners } = await db().from("profiles").select("id").eq("active", true).eq("team_role", "owner");
  for (const o of owners || []) await teams().personal(o.id, { title: "Quarterly review due", text: `Q${q} ${y} ends on ${end}. Take the snapshot and write the three notes.`, href: "/team/plan?tab=reviews" });
  log.push(`review reminder: Q${q}`);
}
