import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

// Resend webhooks (Svix signatures). Stores delivery events per issue and keeps subscriber status in sync.
function verify(body: string, h: Headers) {
  const secret = env.resendWebhookSecret();
  const id = h.get("svix-id"), ts = h.get("svix-timestamp"), sig = h.get("svix-signature");
  if (!secret || !id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sig.split(" ").some((part) => { const b = Buffer.from(part.split(",")[1] ?? "", "base64"); return b.length === expected.length && timingSafeEqual(b, expected); });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verify(body, req.headers)) return new Response("bad signature", { status: 401 });
  const ev = JSON.parse(body) as { type: string; data: { email_id?: string; broadcast_id?: string; to?: string[]; email?: string; unsubscribed?: boolean } };
  const db = supabaseAdmin();
  const email = (ev.data.to?.[0] ?? ev.data.email ?? "").toLowerCase() || null;
  let issue_id: string | null = null;
  if (ev.data.broadcast_id) {
    const { data } = await db.from("newsletter_issues").select("id,broadcast_ids");
    issue_id = data?.find((i) => Object.values(i.broadcast_ids as Record<string, string>).includes(ev.data.broadcast_id!))?.id ?? null;
  }
  await db.from("email_events").insert({ resend_id: ev.data.email_id ?? null, broadcast_id: ev.data.broadcast_id ?? null, issue_id, type: ev.type, email, payload: ev });
  if (email && ev.type === "email.bounced") await db.from("subscribers").update({ status: "bounced" }).eq("email", email);
  if (email && (ev.type === "email.complained" || (ev.type === "contact.updated" && ev.data.unsubscribed))) await db.from("subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("email", email);
  if (ev.data.email_id) await db.from("email_log").update({ status: ev.type.replace("email.", "") }).eq("resend_id", ev.data.email_id);
  return new Response("ok");
}
