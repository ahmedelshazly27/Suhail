"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { logActivity, mentionsIn, plainText } from "@/lib/activity";
import { notifyPeople } from "@/lib/notify";
import { supabaseServer } from "@/lib/supabase/server";
import { STATUSES, PRIORITIES } from "@/lib/team-i18n";

const uuid = z.string().uuid();
const doc = z.object({ type: z.literal("doc") }).passthrough();

const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  project_id: uuid.nullish(), sprint_id: uuid.nullish(), assignee_id: uuid.nullish(), parent_id: uuid.nullish(),
  status: z.enum(STATUSES).default("todo"), priority: z.enum(PRIORITIES).default("none"),
  due_on: z.string().date().nullish(), estimate: z.number().int().min(0).max(100).nullish(), assign_me: z.boolean().optional(),
});

export async function createTicket(input: z.input<typeof createSchema>) {
  const me = await requireMe();
  const { assign_me, ...v } = createSchema.parse(input);
  if (assign_me && !v.assignee_id) v.assignee_id = me.id;
  const db = await supabaseServer();
  const { data, error } = await db.from("tickets").insert({ ...v, created_by: me.id }).select("id,key").single();
  if (error) throw new Error(error.message);
  await logActivity(db, me.id, "ticket", data.id, "created", { title: v.title });
  if (v.assignee_id && v.assignee_id !== me.id) {
    await notifyPeople([v.assignee_id], { kind: "assigned", title: `${me.name} assigned you ${data.key}`, body: v.title, entity_type: "ticket", entity_id: data.id, href: `/team/tickets/${data.key}` });
  }
  revalidatePath("/team", "layout");
  return data as { id: string; key: string };
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(300), description: doc.nullable(), status: z.enum(STATUSES), priority: z.enum(PRIORITIES),
  assignee_id: uuid.nullable(), project_id: uuid.nullable(), sprint_id: uuid.nullable(), parent_id: uuid.nullable(),
  due_on: z.string().date().nullable(), estimate: z.number().int().min(0).max(100).nullable(), labels: z.array(uuid).max(20), flagged: z.boolean(),
  sort: z.number(),
}).partial();

export async function updateTicket(id: string, input: z.input<typeof patchSchema>) {
  const me = await requireMe();
  uuid.parse(id);
  const v = patchSchema.parse(input);
  const db = await supabaseServer();
  const { data: before } = await db.from("tickets").select("key,title,status,assignee_id").eq("id", id).single();
  if (!before) throw new Error("not found");
  const patch: Record<string, unknown> = { ...v };
  if (v.status) patch.completed_at = v.status === "done" ? new Date().toISOString() : null;
  const { error } = await db.from("tickets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  for (const k of Object.keys(v) as (keyof typeof v)[]) {
    if (k === "sort" || k === "description") continue;
    await logActivity(db, me.id, "ticket", id, "changed", { field: k, from: (before as Record<string, unknown>)[k] ?? null, to: v[k] ?? null });
  }
  if (v.assignee_id && v.assignee_id !== before.assignee_id && v.assignee_id !== me.id) {
    await notifyPeople([v.assignee_id], { kind: "assigned", title: `${me.name} assigned you ${before.key}`, body: v.title ?? before.title, entity_type: "ticket", entity_id: id, href: `/team/tickets/${before.key}` });
  }
  if (v.description) {
    const m = mentionsIn(v.description).filter((x) => x !== me.id);
    if (m.length) await notifyPeople(m, { kind: "mention", title: `${me.name} mentioned you in ${before.key}`, body: before.title, entity_type: "ticket", entity_id: id, href: `/team/tickets/${before.key}` });
  }
  revalidatePath("/team", "layout");
}

export async function deleteTicket(id: string, restore = false) {
  const me = await requireMe();
  uuid.parse(id);
  const db = await supabaseServer();
  await db.from("tickets").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("id", id);
  await logActivity(db, me.id, "ticket", id, restore ? "restored" : "deleted");
  revalidatePath("/team", "layout");
}

const commentSchema = z.object({ entity_type: z.enum(["application", "ticket", "relationship", "project", "expense", "content"]), entity_id: uuid, body: doc });

/** Comments on any record (shared by tickets, applications and the rest). Mentions notify people. */
export async function addComment(input: z.input<typeof commentSchema>) {
  const me = await requireMe();
  const v = commentSchema.parse(input);
  const db = await supabaseServer();
  const mentions = mentionsIn(v.body);
  const { error } = await db.from("comments").insert({ ...v, mentions, created_by: me.id });
  if (error) throw new Error(error.message);
  const others = mentions.filter((x) => x !== me.id);
  if (others.length) {
    const href = v.entity_type === "ticket" ? `/team/tickets/${(await db.from("tickets").select("key").eq("id", v.entity_id).single()).data?.key}` : v.entity_type === "application" ? `/team/applications/${v.entity_id}` : "/team";
    await notifyPeople(others, { kind: "mention", title: `${me.name} mentioned you`, body: plainText(v.body).slice(0, 200), entity_type: v.entity_type, entity_id: v.entity_id, href });
  }
  revalidatePath("/team", "layout");
}
