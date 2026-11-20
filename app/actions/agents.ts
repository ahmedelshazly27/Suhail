"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { hashKey, MODELS, newKey, SECTIONS, SHIFTS, textToDoc, type Item } from "@/lib/agents";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// Reviewing the agents' work and running the agent team. Writes go through RLS as the signed-in teammate: owners,
// admins and an agent's desk owner look after it; whoever asked an agent something decides on its answer.

const refresh = () => revalidatePath("/team/agents");
const CHANNELS = ["linkedin", "instagram", "x", "newsletter", "podcast"];
const REL_TYPES = ["Sponsor", "Partner", "Venue", "Speaker", "Podcast guest", "Judge", "Talent"];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null);
const str = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");

const decision = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "done", "reopen"]),
  title: z.string().trim().min(1).max(300).optional(),
  body: z.string().max(20000).optional(),
  feedback: z.string().trim().max(1000).default(""),
  actions: z.array(z.number().int().min(0).max(20)).max(20).optional(), // which suggested actions to turn into tickets
});

const action = z.object({ title: z.string().trim().min(1).max(300), due_on: date }).passthrough();
/** The actions an agent suggested on an item, cleaned up. */
const suggested = (d: Record<string, unknown>) => (Array.isArray(d.actions) ? d.actions : []).slice(0, 20).map((a) => action.safeParse(typeof a === "string" ? { title: a } : a)).flatMap((r) => (r.success ? [r.data] : []));

/**
 * Approve sends the draft where the team works: a post to the Content calendar, a newsletter draft to Newsletter, a
 * lead or a person to Relationships, a grant, task, event or project idea to Tickets. Stories, insights, briefs and
 * answers stay in the agents' library (the Writer works from approved stories). Reject keeps the reason, which the
 * agent reads next run.
 */
export async function decideItem(input: z.input<typeof decision>) {
  const me = await requireMe();
  const v = decision.parse(input);
  const db = await supabaseServer();
  const { data: it } = await db.from("agent_items").select("*").eq("id", v.id).single();
  if (!it) throw new Error("Not found.");
  const item = it as Item;
  const title = v.title ?? item.title, body = v.body ?? item.body;
  const edited = title !== item.title || body !== item.body;
  let routed: { type: string; id: string } | null = null;

  if (v.action === "approve" && !item.routed_id) {
    routed = await route(db, me.id, { ...item, title, body });
    const picked = suggested(item.data || {}).filter((_, i) => (v.actions ?? []).includes(i));
    if (picked.length) await createActions(db, me.id, { ...item, title }, picked, routed);
    await applyLessons(db, me.id, item);
  }
  const status = v.action === "approve" ? "approved" : v.action === "reject" ? "rejected" : v.action === "done" ? "done" : "new";
  const { error } = await db.from("agent_items").update({
    status, title, body, edited: item.edited || edited, feedback: v.action === "reopen" ? item.feedback : v.feedback || item.feedback,
    decided_by: v.action === "reopen" ? null : me.id, decided_at: v.action === "reopen" ? null : new Date().toISOString(),
    ...(routed ? { routed_type: routed.type, routed_id: routed.id } : {}),
  }).eq("id", v.id);
  if (error) throw new Error(error.message.includes("row-level security") ? "Only this agent's desk owner or an admin can decide on its work." : error.message);
  refresh();
  return routed;
}

type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Ticked actions become tickets for the desk owner; on a relationship, the first one is also its next step. */
async function createActions(db: Db, meId: string, item: Item, picked: z.infer<typeof action>[], routed: { type: string; id: string } | null) {
  const { data: agent } = await db.from("agents").select("name,owner_id").eq("key", item.agent_key).single();
  const owner = (agent?.owner_id as string | null) || meId;
  const about = routed?.type === "relationship" ? `relationship ${item.title}` : item.title;
  for (const a of picked) {
    const { data, error } = await db.from("tickets").insert({
      title: a.title.slice(0, 300), status: "todo", assignee_id: owner, due_on: a.due_on ?? null, source: "agent", source_ref: routed?.id ?? item.id,
      description: textToDoc(`Suggested by ${agent?.name ?? "an agent"} for ${about}.\n\nOpen it in Agents: /team/agents?item=${item.id}`),
    }).select("id").single();
    if (error) throw new Error(error.message);
    await logActivity(db, meId, "ticket", data.id, "created", { from: "agent", agent: item.agent_key });
  }
  if (routed?.type === "relationship") await db.from("relationships").update({ next_step: picked[0].title.slice(0, 300), next_due: picked[0].due_on ?? null }).eq("id", routed.id);
}

/** The Coach proposes new lessons for an agent; approving the proposal applies them. */
async function applyLessons(db: Db, meId: string, item: Item) {
  const p = (item.data || {}).apply_lessons as { agent?: unknown; lessons?: unknown } | undefined;
  if (!p || typeof p.agent !== "string" || typeof p.lessons !== "string" || !p.lessons.trim()) return;
  const { data, error } = await db.from("agents").update({ lessons: p.lessons.slice(0, 8000), updated_by: meId }).eq("key", p.agent).select("key");
  if (error || !data?.length) throw new Error("Only that agent's desk owner or an admin can change what it has learned.");
}
async function route(db: Db, meId: string, item: Item): Promise<{ type: string; id: string } | null> {
  const d = item.data || {};
  const srcs = item.sources.map((s) => `- ${s.title ? s.title + ": " : ""}${s.url}${s.date ? ` (${s.date})` : ""}`).join("\n");
  const full = [item.body, srcs ? `Sources:\n${srcs}` : ""].filter(Boolean).join("\n\n");
  const { data: agent } = await db.from("agents").select("name,owner_id").eq("key", item.agent_key).single();
  const owner = (agent?.owner_id as string | null) || meId;
  const ok = (r: { data: { id: string } | null; error: { message: string } | null }) => { if (r.error || !r.data) throw new Error(r.error?.message || "Could not save."); return r.data; };

  if (item.kind === "post") {
    const channel = CHANNELS.includes(str(d.channel)) ? str(d.channel) : "linkedin";
    const row = ok(await db.from("content_items").insert({ channel, title: item.title.slice(0, 200), status: "approved", publish_on: date.parse(d.publish_on) ?? null, owner_id: owner, notes: full.slice(0, 20000) }).select("id").single());
    return { type: "content", id: row.id };
  }
  if (item.kind === "newsletter") {
    const ar = str(d.lang) === "ar";
    const row = ok(await db.from("newsletter_issues").insert({ title: item.title.slice(0, 200), [ar ? "subject_ar" : "subject_en"]: item.title.slice(0, 200), [ar ? "body_ar" : "body_en"]: textToDoc(item.body), segment: ar ? "ar" : "en", created_by: meId }).select("id").single());
    return { type: "newsletter", id: row.id };
  }
  if (item.kind === "lead" || item.kind === "person") {
    const orgName = str(d.org, 160) || (item.kind === "lead" ? item.title.slice(0, 160) : "");
    let organisation_id: string | null = null;
    if (orgName) {
      const { data: existing } = await db.from("organisations").select("id").ilike("name", orgName).limit(1).maybeSingle();
      organisation_id = existing?.id ?? ok(await db.from("organisations").insert({ name: orgName, website: str(d.url, 500) || null }).select("id").single()).id;
    }
    const c = (d.contact || {}) as Record<string, unknown>;
    const contactName = item.kind === "person" ? item.title.split(/[,·(–-]/)[0].trim().slice(0, 120) : str(c.name, 120);
    const contact_id = contactName ? ok(await db.from("contacts").insert({ name: contactName, title: str(c.title, 160), organisation_id }).select("id").single()).id : null;
    const type = REL_TYPES.includes(str(d.type)) ? str(d.type) : item.kind === "person" ? "Podcast guest" : "Partner";
    const rel = ok(await db.from("relationships").insert({ name: item.title.slice(0, 200), organisation_id, contact_id, type, stage: "Prospect", owner_id: owner, next_step: str(d.next_step, 300) || "Send the first message (draft in the history)" }).select("id").single());
    await db.from("relationship_events").insert({ relationship_id: rel.id, what: `Found by ${agent?.name ?? "an agent"}.\n\n${full}`.slice(0, 20000), via: "agent" });
    return { type: "relationship", id: rel.id };
  }
  if (["grant", "task", "event", "project"].includes(item.kind)) {
    const title = (item.kind === "project" ? `Idea: ${item.title}` : item.kind === "grant" ? `Apply: ${item.title}` : item.title).slice(0, 300);
    const row = ok(await db.from("tickets").insert({ title, description: textToDoc(full), status: item.kind === "project" ? "backlog" : "todo", assignee_id: owner, due_on: date.parse(d.due_on) ?? null, source: "agent", source_ref: item.id }).select("id").single());
    await logActivity(db, meId, "ticket", row.id, "created", { from: "agent", agent: item.agent_key });
    return { type: "ticket", id: row.id };
  }
  return null;
}

const settings = z.object({
  key: z.string(),
  name: z.string().trim().min(1).max(80),
  purpose: z.string().trim().max(300),
  instructions: z.string().max(20000),
  lessons: z.string().max(8000),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  shift: z.enum(SHIFTS),
  model: z.enum(MODELS),
  web: z.boolean(),
  reads: z.array(z.enum(SECTIONS)).max(SECTIONS.length),
  owner_id: z.string().uuid().nullish(),
});

/** An agent's settings. The desk owner tunes everything; only owners and admins move an agent to another desk owner. */
export async function saveAgent(input: z.input<typeof settings>) {
  const me = await requireMe();
  const v = settings.parse(input);
  const db = await supabaseServer();
  const { owner_id, key, ...rest } = v;
  const patch = { ...rest, days: [...new Set(v.days)].sort(), updated_by: me.id, ...(isAdmin(me) ? { owner_id: owner_id || null } : {}) };
  const { data, error } = await db.from("agents").update(patch).eq("key", key).select("key");
  if (error || !data?.length) throw new Error("Only this agent's desk owner or an admin can change it.");
  refresh();
}

export async function setAgent(key: string, change: { enabled?: boolean; run?: boolean }) {
  await requireMe();
  const db = await supabaseServer();
  const patch = { ...(change.enabled !== undefined ? { enabled: change.enabled } : {}), ...(change.run ? { run_requested_at: new Date().toISOString() } : {}) };
  const { data, error } = await db.from("agents").update(patch).eq("key", z.string().parse(key)).select("key");
  if (error || !data?.length) throw new Error("Only this agent's desk owner or an admin can change it.");
  refresh();
}

/** The kill switch: no agent runs while this is on. */
export async function pauseAgents(paused: boolean) {
  const me = await requireMe();
  if (!isAdmin(me)) throw new Error("Only owners and admins can pause the agent team.");
  const db = await supabaseServer();
  const { data } = await db.from("settings").select("data").single();
  const { error } = await db.from("settings").update({ data: { ...(data?.data as object), agents_paused: paused }, updated_by: me.id }).eq("id", true);
  if (error) throw new Error(error.message);
  refresh();
}

/** Anyone on the team can ask any agent for something; it answers at its next shift. */
export async function askAgent(key: string, body: string) {
  await requireMe();
  const db = await supabaseServer();
  const { error } = await db.from("agent_requests").insert({ agent_key: z.string().parse(key), body: z.string().trim().min(1).max(2000).parse(body) });
  if (error) throw new Error(error.message);
  refresh();
}

export async function cancelAsk(id: string) {
  await requireMe();
  const db = await supabaseServer();
  await db.from("agent_requests").update({ status: "cancelled" }).eq("id", z.string().uuid().parse(id)).eq("status", "open");
  refresh();
}

/** A key for the Claude routine. Shown once; only its hash is kept. */
export async function createAgentKey(name: string) {
  const me = await requireMe();
  if (!isAdmin(me)) throw new Error("Only owners and admins can connect the agent team.");
  const key = newKey();
  const { error } = await supabaseAdmin().from("agent_keys").insert({ name: z.string().trim().min(1).max(80).parse(name), hash: hashKey(key), created_by: me.id });
  if (error) throw new Error(error.message);
  refresh();
  return key;
}

export async function revokeAgentKey(id: string) {
  const me = await requireMe();
  if (!isAdmin(me)) throw new Error("Only owners and admins can do this.");
  await supabaseAdmin().from("agent_keys").update({ revoked_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id));
  refresh();
}

