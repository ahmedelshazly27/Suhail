import "server-only";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

// Azure Bot (free tier) for personal cards. The bot stores each person's conversation reference the first time
// they message it or install the app (see /api/teams/messages). Off until MICROSOFT_BOT_ID and _PASSWORD are set.

let cached: { token: string; exp: number } | null = null;
async function botToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const { id, password } = env.bot();
  const tenant = env.azure().tenant || "botframework.com";
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: password, scope: "https://api.botframework.com/.default" }),
  });
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export async function sendPersonalCard(profileId: string, card: unknown) {
  const { id, password } = env.bot();
  if (!id || !password) return;
  const { data } = await supabaseAdmin().from("profiles").select("teams_ref").eq("id", profileId).maybeSingle();
  const ref = (data as { teams_ref?: { serviceUrl: string; conversationId: string } } | null)?.teams_ref;
  if (!ref?.serviceUrl || !ref.conversationId) return;
  await fetch(`${ref.serviceUrl.replace(/\/$/, "")}/v3/conversations/${ref.conversationId}/activities`, {
    method: "POST",
    headers: { authorization: `Bearer ${await botToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }] }),
  });
}
