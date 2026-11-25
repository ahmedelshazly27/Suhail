"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
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
