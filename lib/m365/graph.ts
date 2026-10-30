import "server-only";
import { env } from "@/lib/env";
import { open, seal } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

// Microsoft Graph from server code only. Delegated tokens act as the teammate; app-only tokens are for background jobs.
export const m365Live = () => env.azureReady();

const tokenUrl = () => `https://login.microsoftonline.com/${env.azure().tenant}/oauth2/v2.0/token`;
const memo = new Map<string, { token: string; exp: number }>();

/** Delegated access token for a teammate, refreshed silently from the encrypted refresh token. */
export async function delegatedToken(profileId: string): Promise<string | null> {
  const hit = memo.get(profileId);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const db = supabaseAdmin();
  const { data } = await db.from("graph_tokens").select("refresh_token_enc").eq("profile_id", profileId).maybeSingle();
  if (!data) return null;
  const { clientId, secret } = env.azure();
  const r = await fetch(tokenUrl(), { method: "POST", body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: "refresh_token", refresh_token: open(data.refresh_token_enc), scope: "https://graph.microsoft.com/.default offline_access" }) });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  memo.set(profileId, { token: j.access_token, exp: Date.now() + j.expires_in * 1000 });
  if (j.refresh_token) await db.from("graph_tokens").update({ refresh_token_enc: seal(j.refresh_token), expires_at: new Date(Date.now() + 90 * 864e5).toISOString() }).eq("profile_id", profileId);
  return j.access_token;
}

/** App-only token (client credentials) for cron jobs and change subscriptions. */
export async function appToken(): Promise<string> {
  const hit = memo.get("@app");
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const { clientId, secret } = env.azure();
  const r = await fetch(tokenUrl(), { method: "POST", body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }) });
  const j = (await r.json()) as { access_token: string; expires_in: number };
  memo.set("@app", { token: j.access_token, exp: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

export async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`graph ${r.status} ${path}`);
  return (r.status === 204 ? null : await r.json()) as T;
}
