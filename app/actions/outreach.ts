"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireMe } from "@/lib/auth";
import { writeEmail } from "@/lib/outreach";
import { supabaseServer } from "@/lib/supabase/server";

// Emailing a relationship from the dashboard: the message goes out from the signed-in person's own Outlook (so it
// sits in their Sent Items and replies come back to them), with their signature, and is logged on the timeline.

const email = z.object({
  relationship_id: z.string().uuid(),
  to: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  send: z.boolean(),
});

/** Saves the email to the person's Outlook Drafts, or sends it, and records it on the relationship. */
export async function emailRelationship(input: z.input<typeof email>) {
  const me = await requireMe();
  const v = email.parse(input);
  const db = await supabaseServer();
  const out = await writeEmail(db, me, v);
  revalidatePath("/team/relationships");
  return out;
}

// ---------------------------------------------------------------- partner outreach

/** Imports the researched partner pack into Relationships and Outreach. Admins only; safe to run again. */
export async function importOutreach() {
  const me = await requireAdmin();
  const { importPack } = await import("@/lib/outreach-pack");
  const out = await importPack(await supabaseServer(), me.id);
  revalidatePath("/team/outreach"); revalidatePath("/team/relationships");
  return out;
}

const outreachEmail = email.omit({ relationship_id: true }).extend({ id: z.string().uuid() });

/** Sends (or saves to Drafts) one outreach email from the signed-in person's Outlook, with their signature. */
export async function sendOutreach(input: z.input<typeof outreachEmail>) {
  const me = await requireMe();
  const v = outreachEmail.parse(input);
  const db = await supabaseServer();
  const { data: o } = await db.from("outreach").select("id,relationship_id,status").eq("id", v.id).single();
  if (!o) throw new Error("Not found.");
  if (o.status === "sent") throw new Error("This one was already sent.");
  const out = await writeEmail(db, me, { relationship_id: o.relationship_id, to: v.to, subject: v.subject, body: v.body, send: v.send }, "Outreach");
  await db.from("outreach").update({ subject: v.subject, body: v.body, status: v.send ? "sent" : "drafted", ...(v.send ? { sent_at: new Date().toISOString(), sent_by: me.id } : {}) }).eq("id", o.id);
  revalidatePath("/team/outreach"); revalidatePath("/team/relationships");
  return out;
}

const patch = z.object({ subject: z.string().trim().max(200).optional(), body: z.string().trim().max(20000).optional(), status: z.enum(["ready", "skipped"]).optional() });

/** Keeps edits to a draft, or skips / restores an organisation. */
export async function saveOutreach(id: string, input: z.input<typeof patch>) {
  await requireMe();
  const v = patch.parse(input);
  const db = await supabaseServer();
  const { error } = await db.from("outreach").update(v).eq("id", z.string().uuid().parse(id)).neq("status", "sent");
  if (error) throw new Error(error.message);
  revalidatePath("/team/outreach");
}
