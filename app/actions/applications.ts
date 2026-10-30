"use server";
import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/render";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { logActivity, mentionsIn, plainText } from "@/lib/activity";
import { getApplication } from "@/lib/data/applications";
import { sendEmail } from "@/lib/email/send";
import { notifyPeople } from "@/lib/notify";
import { supabaseServer } from "@/lib/supabase/server";
import { Templated, fill } from "@/emails/Templated";

const ids = z.array(z.string().uuid()).min(1).max(200);

export async function loadApplication(id: string) {
  const me = await requireMe();
  return getApplication(z.string().uuid().parse(id), me.id);
}

/** Move one or many applicants. Notifies the assignee and logs the change on each. */
export async function moveStage(input: { ids: string[]; stage: string }) {
  const me = await requireMe();
  const v = z.object({ ids, stage: z.string().min(1).max(40) }).parse(input);
  const db = await supabaseServer();
  const { data } = await db.from("applications").update({ stage: v.stage, stage_changed_at: new Date().toISOString() }).in("id", v.ids).select("id,name,assignee_id");
  for (const a of data || []) {
    await logActivity(db, me.id, "application", a.id, "stage", { to: v.stage });
    if (a.assignee_id && a.assignee_id !== me.id) await notifyPeople([a.assignee_id], { kind: "stage", title: `${a.name} moved to ${v.stage}`, entity_type: "application", entity_id: a.id, href: `/team/applications/${a.id}` });
  }
  revalidatePath("/team", "layout");
}

export async function assignApplications(input: { ids: string[]; assignee: string | null }) {
  const me = await requireMe();
  const v = z.object({ ids, assignee: z.string().uuid().nullable() }).parse(input);
  const db = await supabaseServer();
  await db.from("applications").update({ assignee_id: v.assignee }).in("id", v.ids);
  for (const id of v.ids) await logActivity(db, me.id, "application", id, "changed", { field: "assignee_id", to: v.assignee });
  if (v.assignee && v.assignee !== me.id) await notifyPeople([v.assignee], { kind: "assigned", title: `${me.name} asked you to review ${v.ids.length} application${v.ids.length > 1 ? "s" : ""}`, entity_type: "application", entity_id: v.ids[0], href: v.ids.length === 1 ? `/team/applications/${v.ids[0]}` : "/team/my-work" });
  revalidatePath("/team", "layout");
}

export async function tagApplications(input: { ids: string[]; tag: string }) {
  const me = await requireMe();
  const v = z.object({ ids, tag: z.string().trim().min(1).max(30) }).parse(input);
  const db = await supabaseServer();
  const { data } = await db.from("applications").select("id,tags").in("id", v.ids);
  for (const a of data || []) { await db.from("applications").update({ tags: [...new Set([...(a.tags || []), v.tag])] }).eq("id", a.id); await logActivity(db, me.id, "application", a.id, "changed", { field: "tags", to: v.tag }); }
  revalidatePath("/team/applications");
}

/** Your 1 to 5 score on one rubric criterion. The application's score is the mean across reviewers and criteria. */
export async function scoreApplication(input: { id: string; criterion: string; score: number }) {
  const me = await requireMe();
  const v = z.object({ id: z.string().uuid(), criterion: z.string().min(1).max(40), score: z.number().int().min(1).max(5) }).parse(input);
  const db = await supabaseServer();
  await db.from("rubric_scores").upsert({ application_id: v.id, profile_id: me.id, criterion: v.criterion, score: v.score }, { onConflict: "application_id,profile_id,criterion" });
  const { data } = await db.from("rubric_scores").select("score").eq("application_id", v.id);
  const avg = data?.length ? data.reduce((n, s) => n + s.score, 0) / data.length : null;
  await db.from("applications").update({ score: avg }).eq("id", v.id);
  await logActivity(db, me.id, "application", v.id, "scored", { criterion: v.criterion });
  revalidatePath("/team/applications");
}

export async function addNote(input: { id: string; body: unknown }) {
  const me = await requireMe();
  const v = z.object({ id: z.string().uuid(), body: z.object({ type: z.literal("doc") }).passthrough() }).parse(input);
  const db = await supabaseServer();
  const mentions = mentionsIn(v.body);
  await db.from("application_notes").insert({ application_id: v.id, body: v.body, mentions, created_by: me.id });
  const others = mentions.filter((m) => m !== me.id);
  if (others.length) await notifyPeople(others, { kind: "mention", title: `${me.name} mentioned you on an application`, body: plainText(v.body).slice(0, 200), entity_type: "application", entity_id: v.id, href: `/team/applications/${v.id}` });
  revalidatePath("/team/applications");
}

async function compose(appId: string, key: string, meId: string) {
  const db = await supabaseServer();
  const [{ data: a }, { data: tpl }] = await Promise.all([
    db.from("applications").select("id,name,email,lang,form_key,role:roles(plain_en,plain_ar),form:forms(name_en,name_ar)").eq("id", appId).single(),
    db.from("email_templates").select("*").eq("key", key).single(),
  ]);
  if (!a || !tpl) throw new Error("not found");
  const lang = a.lang === "en" ? "en" : "ar";
  const role = a.role as unknown as { plain_en: string; plain_ar: string } | null, form = a.form as unknown as { name_en: string; name_ar: string };
  const vars = { name: (a.name || "").split(" ")[0], role: role ? (lang === "ar" ? role.plain_ar : role.plain_en) : lang === "ar" ? form.name_ar : form.name_en };
  const subject = fill(lang === "ar" ? tpl.subject_ar : tpl.subject_en, vars);
  const react = createElement(Templated, { lang, bodyAr: tpl.body_ar, bodyEn: tpl.body_en, vars });
  void meId;
  return { a, subject, react, lang };
}

/** Preview exactly what the applicant will get, in their language. */
export async function previewTemplate(input: { id: string; key: string }) {
  const me = await requireMe();
  const v = z.object({ id: z.string().uuid(), key: z.string().max(40) }).parse(input);
  const c = await compose(v.id, v.key, me.id);
  return { to: c.a.email, subject: c.subject, html: await render(c.react) };
}

/** Templated email to one or many applicants, through Resend. Every send is logged on the applicant. */
export async function emailApplicants(input: { ids: string[]; key: string }) {
  const me = await requireMe();
  const v = z.object({ ids, key: z.string().max(40) }).parse(input);
  const db = await supabaseServer();
  let sent = 0;
  for (const id of v.ids) {
    const c = await compose(id, v.key, me.id);
    const r = await sendEmail({ to: c.a.email, subject: c.subject, react: c.react, log: { template: v.key, entity_type: "application", entity_id: id, created_by: me.id } });
    await logActivity(db, me.id, "application", id, "emailed", { subject: c.subject, template: v.key, redirected: r.redirected ?? false });
    if (r.ok || r.error === "no_key") sent++;
  }
  revalidatePath("/team/applications");
  return sent;
}

export async function deleteApplication(id: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  await db.from("applications").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id));
  await logActivity(db, me.id, "application", id, "deleted");
  revalidatePath("/team/applications");
}
