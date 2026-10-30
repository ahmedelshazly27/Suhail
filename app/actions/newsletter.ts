"use server";
import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { z } from "zod";
import { requireAdmin, requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { env } from "@/lib/env";
import { docToEmailHtml } from "@/lib/rich-text";
import { sendEmail } from "@/lib/email/send";
import { supabaseServer } from "@/lib/supabase/server";
import { Issue } from "@/emails/Issue";

const doc = z.object({ type: z.literal("doc") }).passthrough().nullable();
const lang = z.enum(["ar", "en"]);

export async function createIssue() {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data: last } = await db.from("newsletter_issues").select("number").order("number", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { data } = await db.from("newsletter_issues").insert({ number: (last?.number ?? 0) + 1, title: "Untitled issue", created_by: me.id }).select("id").single();
  redirect(`/team/newsletter/${data!.id}`);
}

const patch = z.object({ title: z.string().max(200), subject_ar: z.string().max(200), subject_en: z.string().max(200), body_ar: doc, body_en: doc, segment: z.enum(["ar", "en", "both"]) }).partial();
export async function saveIssue(id: string, input: z.input<typeof patch>) {
  await requireMe();
  const db = await supabaseServer();
  await db.from("newsletter_issues").update(patch.parse(input)).eq("id", z.string().uuid().parse(id)).eq("status", "draft");
}

/** The exact email a subscriber gets, rendered with the React Email template. */
export async function renderIssue(input: { lang: "ar" | "en"; title: string; body: unknown; unsubscribeUrl?: string }) {
  await requireMe();
  const l = lang.parse(input.lang);
  return render(createElement(Issue, { lang: l, title: input.title, html: docToEmailHtml(input.body, l), unsubscribeUrl: input.unsubscribeUrl ?? `${env.siteUrl()}${l === "en" ? "/en" : ""}/newsletter/unsubscribe` }));
}

export async function sendTest(id: string, l: "ar" | "en") {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data: i } = await db.from("newsletter_issues").select("*").eq("id", z.string().uuid().parse(id)).single();
  if (!i) throw new Error("not found");
  const subject = (l === "ar" ? i.subject_ar : i.subject_en) || i.title;
  const r = await sendEmail({ to: me.email, subject: `[Test] ${subject}`, react: createElement(Issue, { lang: l, title: subject, html: docToEmailHtml(l === "ar" ? i.body_ar : i.body_en, l), unsubscribeUrl: `${env.siteUrl()}/newsletter/unsubscribe` }), log: { template: "newsletter_test", entity_type: "newsletter_issue", entity_id: id, created_by: me.id } });
  if (!r.ok && r.error !== "no_key") throw new Error(r.error);
  return me.email;
}

/**
 * Send or schedule through Resend Broadcasts, one broadcast per language segment.
 * Broadcasts reach real subscribers, so they stay off until MAIL_ALLOWLIST is lifted ("*"). See BLOCKERS.md.
 */
export async function sendIssue(id: string, opts: { segment: "ar" | "en" | "both"; scheduledAt?: string | null }) {
  const me = await requireAdmin();
  if (process.env.MAIL_ALLOWLIST !== "*") throw new Error("Broadcasts are switched off until the owner lifts the email safety switch (BLOCKERS.md). Send a test instead.");
  const v = z.object({ segment: z.enum(["ar", "en", "both"]), scheduledAt: z.string().datetime().nullish() }).parse(opts);
  const db = await supabaseServer();
  const { data: i } = await db.from("newsletter_issues").select("*").eq("id", z.string().uuid().parse(id)).single();
  if (!i || i.status !== "draft") throw new Error("Only drafts can be sent.");
  const resend = new Resend(env.resendKey());
  const ids: Record<string, string> = {};
  for (const l of v.segment === "both" ? (["ar", "en"] as const) : [v.segment]) {
    const subject = (l === "ar" ? i.subject_ar : i.subject_en) || i.title;
    const html = await render(createElement(Issue, { lang: l, title: subject, html: docToEmailHtml(l === "ar" ? i.body_ar : i.body_en, l), unsubscribeUrl: "{{{RESEND_UNSUBSCRIBE_URL}}}" }));
    const { data, error } = await resend.broadcasts.create({ segmentId: env.resendAudience(l), from: env.mailFrom(), subject, html, name: `Issue ${i.number ?? ""} (${l})`, ...(v.scheduledAt ? { scheduledAt: v.scheduledAt } : {}), send: true } as never);
    if (error || !data) throw new Error(error?.message ?? "Resend error");
    ids[l] = (data as { id: string }).id;
  }
  await db.from("newsletter_issues").update({ status: v.scheduledAt ? "scheduled" : "sent", scheduled_at: v.scheduledAt ?? null, sent_at: v.scheduledAt ? null : new Date().toISOString(), broadcast_ids: ids, segment: v.segment }).eq("id", id);
  await logActivity(db, me.id, "newsletter_issue", id, v.scheduledAt ? "scheduled" : "sent", { segment: v.segment });
  revalidatePath("/team/newsletter");
}
