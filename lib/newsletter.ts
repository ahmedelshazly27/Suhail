import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

type Sub = { id: string; email: string; lang: "ar" | "en"; status: string; resend_contact_id: string | null };

/** Supabase is the source of truth; Resend mirrors it so broadcasts and suppression work there. */
export async function syncSubscriber(s: Sub) {
  if (!env.resendKey()) return;
  const resend = new Resend(env.resendKey());
  const unsubscribed = s.status !== "active";
  const segment = env.resendAudience(s.lang);
  if (!s.resend_contact_id) {
    if (unsubscribed) return; // never pushed, nothing to update
    const { data, error } = await resend.contacts.create({ email: s.email, unsubscribed: false, segments: segment ? [{ id: segment }] : undefined });
    if (data?.id) await supabaseAdmin().from("subscribers").update({ resend_contact_id: data.id }).eq("id", s.id);
    else if (error) {
      // Already a contact in Resend: update it instead.
      await resend.contacts.update({ email: s.email, unsubscribed: false } as never);
    }
    return;
  }
  await resend.contacts.update({ id: s.resend_contact_id, unsubscribed } as never);
}
