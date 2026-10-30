import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function clientIpHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip + (env.serviceRole().slice(-16) || "suhail")).digest("hex").slice(0, 32);
}

/** Per-IP fixed window, stored in Supabase. Fails closed if the database can't be reached. */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number) {
  const { data, error } = await supabaseAdmin().rpc("hit_rate_limit", { p_bucket: bucket, p_key: await clientIpHash(), p_limit: limit, p_window_seconds: windowSeconds });
  if (error) { console.error("rate limit", error.message); return false; }
  return data === true;
}

/** Secret Graph echoes back on every change notification. Derived from CRON_SECRET (an HMAC, so the secret itself
 * never leaves us); empty, and so never accepted, when CRON_SECRET isn't set. */
export const graphClientState = () => (env.cronSecret() ? createHmac("sha256", env.cronSecret()).update("graph-client-state").digest("hex") : "");

export function sameSecret(a: string | undefined, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Cloudflare Turnstile. Uses Cloudflare's published test secret until real keys are set. */
export async function verifyTurnstile(token: string | null | undefined) {
  // End-to-end tests run without Cloudflare. The bypass is ignored on every Vercel deployment.
  if (process.env.E2E === "1" && !process.env.VERCEL) return true;
  if (!token) return false;
  if (env.isProduction() && !process.env.TURNSTILE_SECRET_KEY) console.warn("Turnstile is using Cloudflare's test keys in Production: set TURNSTILE_SECRET_KEY (BLOCKERS.md)");
  const body = new URLSearchParams({ secret: env.turnstileSecret(), response: token });
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}
