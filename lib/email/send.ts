import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Every email the app sends goes through here.
 * MAIL_ALLOWLIST (comma-separated) limits real recipients: anything else is redirected to MAIL_SAFE_TO with the
 * intended recipient in the subject. It is set in every environment until the owner lifts it (see BLOCKERS.md).
 */
export function deliverTo(to: string): { to: string; redirected: boolean } {
  const allow = (process.env.MAIL_ALLOWLIST ?? "a.elshazly@suhail.build").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (process.env.MAIL_ALLOWLIST === "*") return { to, redirected: false };
  if (allow.includes(to.toLowerCase())) return { to, redirected: false };
  return { to: env.mailSafeTo(), redirected: true };
}

export type Sent = { ok: boolean; id?: string; error?: string; redirected?: boolean };

export async function sendEmail(opts: {
  to: string; subject: string; react: ReactElement; text?: string;
  unsubscribeUrl?: string; log?: { template?: string; entity_type?: string; entity_id?: string; created_by?: string | null };
}): Promise<Sent> {
  const { to, redirected } = deliverTo(opts.to);
  const subject = redirected ? `[to ${opts.to}] ${opts.subject}` : opts.subject;
  const html = await render(opts.react);
  const text = opts.text ?? (await render(opts.react, { plainText: true }));
  let result: Sent;
  if (!env.resendKey()) {
    console.warn("RESEND_API_KEY missing; email not sent:", subject);
    result = { ok: false, error: "no_key", redirected };
  } else {
    const headers: Record<string, string> = {};
    if (opts.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const { data, error } = await new Resend(env.resendKey()).emails.send({ from: env.mailFrom(), to, subject, html, text, headers });
    result = error ? { ok: false, error: error.message, redirected } : { ok: true, id: data?.id, redirected };
  }
  if (opts.log) {
    await supabaseAdmin().from("email_log").insert({
      to_email: opts.to, subject: opts.subject, template: opts.log.template, entity_type: opts.log.entity_type, entity_id: opts.log.entity_id,
      resend_id: result.id, status: result.ok ? (redirected ? "redirected" : "sent") : "failed", created_by: opts.log.created_by ?? null,
    });
  }
  return result;
}
