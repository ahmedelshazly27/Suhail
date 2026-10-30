"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { addDays, todayISO } from "@/lib/dates";
import { mail } from "@/lib/m365/mail";
import { notifyPeople } from "@/lib/notify";
import { supabaseServer } from "@/lib/supabase/server";
import { createTicket } from "./tickets";

const ref = z.object({ mailbox: z.string().min(1).max(200), id: z.string().min(1).max(400) });

/** Only metadata is stored: ids, subject, sender and the Outlook link. Bodies are always fetched live. */
async function linkRow(me: { id: string }, mailbox: string, id: string, extra: Record<string, unknown>) {
  const db = await supabaseServer();
  const m = await (await mail(me.id)).get(mailbox, id);
  if (!m) throw new Error("not found");
  await db.from("mail_links").insert({ mailbox, message_id: id, conversation_id: m.conversationId ?? null, subject: m.subject, from_email: m.fromEmail, received_at: m.received, web_link: m.webLink, created_by: me.id, ...extra });
  return { db, m };
}

export async function replyToMail(input: { mailbox: string; id: string; text: string }) {
  const me = await requireMe();
  const v = ref.extend({ text: z.string().trim().min(1).max(20000) }).parse(input);
  await (await mail(me.id)).reply(v.mailbox, v.id, v.text);
}

export async function ticketFromMail(input: { mailbox: string; id: string; project_id?: string | null }) {
  const me = await requireMe();
  const v = ref.extend({ project_id: z.string().uuid().nullish() }).parse(input);
  const m = await (await mail(me.id)).get(v.mailbox, v.id);
  if (!m) throw new Error("not found");
  const t = await createTicket({ title: m.subject.replace(/^(re|fw|fwd):\s*/i, "").slice(0, 300), project_id: v.project_id ?? null, assignee_id: me.id, status: "todo" });
  const db = await supabaseServer();
  await db.from("tickets").update({ source: "email", source_ref: m.webLink, description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `${m.from}: ${m.snippet}` }] }] } }).eq("id", t.id);
  await db.from("mail_links").insert({ mailbox: v.mailbox, message_id: v.id, subject: m.subject, from_email: m.fromEmail, received_at: m.received, web_link: m.webLink, entity_type: "ticket", entity_id: t.id, created_by: me.id });
  revalidatePath("/team/inbox");
  return t;
}

export async function linkMailToRelationship(input: { mailbox: string; id: string; relationship_id: string }) {
  const me = await requireMe();
  const v = ref.extend({ relationship_id: z.string().uuid() }).parse(input);
  const { db, m } = await linkRow(me, v.mailbox, v.id, { entity_type: "relationship", entity_id: v.relationship_id });
  await db.from("relationship_events").insert({ relationship_id: v.relationship_id, happened_at: m.received, what: m.subject, via: `Email to ${v.mailbox === "me" ? "you" : v.mailbox.split("@")[0] + "@"}`, mail_message_id: v.id, created_by: me.id });
  await db.from("relationships").update({ last_contact_at: m.received, last_contact_via: "Email" }).eq("id", v.relationship_id);
  await logActivity(db, me.id, "relationship", v.relationship_id, "email_linked", { subject: m.subject });
  revalidatePath("/team/inbox");
}

export async function assignMail(input: { mailbox: string; id: string; assignee: string }) {
  const me = await requireMe();
  const v = ref.extend({ assignee: z.string().uuid() }).parse(input);
  const { m } = await linkRow(me, v.mailbox, v.id, { assignee_id: v.assignee });
  if (v.assignee !== me.id) await notifyPeople([v.assignee], { kind: "assigned", title: `${me.name} assigned you an email`, body: m.subject, href: `/team/inbox?mb=${encodeURIComponent(v.mailbox)}&id=${encodeURIComponent(v.id)}` });
  revalidatePath("/team/inbox");
}

export async function snoozeMail(input: { mailbox: string; id: string; days: number }) {
  const me = await requireMe();
  const v = ref.extend({ days: z.number().int().min(1).max(30) }).parse(input);
  await linkRow(me, v.mailbox, v.id, { snoozed_until: addDays(todayISO(), v.days) + "T06:00:00Z" });
  revalidatePath("/team/inbox");
}

export async function markNotificationsRead(ids?: string[]) {
  const me = await requireMe();
  const db = await supabaseServer();
  let q = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("profile_id", me.id).is("read_at", null);
  if (ids?.length) q = q.in("id", z.array(z.string().uuid()).parse(ids));
  await q;
  revalidatePath("/team", "layout");
}
