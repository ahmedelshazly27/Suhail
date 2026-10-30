import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { addDays, todayISO } from "@/lib/dates";
import { isBotServiceUrl } from "@/lib/m365/bot";
import { supabaseAdmin } from "@/lib/supabase/server";

// Suhail bot (Azure Bot, free tier). Off until MICROSOFT_BOT_ID and MICROSOFT_BOT_PASSWORD are set.
const jwks = createRemoteJWKSet(new URL("https://login.botframework.com/v1/.well-known/keys"));

type Activity = { type: string; name?: string; text?: string; serviceUrl: string; conversation: { id: string }; from: { aadObjectId?: string; id: string }; value?: { action?: { verb?: string; data?: Record<string, string> } } };

export async function POST(req: Request) {
  const { id: botId } = env.bot();
  if (!botId) return new Response("Bot not configured", { status: 503 });
  let claim: string | undefined;
  try {
    const { payload } = await jwtVerify((req.headers.get("authorization") || "").replace(/^Bearer /, ""), jwks, { issuer: "https://api.botframework.com", audience: botId });
    claim = (payload.serviceurl ?? payload.serviceUrl) as string | undefined; // Bot Framework spells it both ways
  } catch { return new Response("Unauthorized", { status: 401 }); }

  const a = (await req.json()) as Activity;
  // The body isn't signed; the token's serviceUrl claim is. Only trust a body that matches it.
  if (!claim || claim !== a.serviceUrl || !isBotServiceUrl(a.serviceUrl)) return new Response("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const { data: me } = a.from.aadObjectId ? await db.from("profiles").select("id,name,active").eq("ms_oid", a.from.aadObjectId).maybeSingle() : { data: null };
  if (!me?.active) return Response.json({ type: "message", text: "This bot only works for the Suhail team." });
  // Remember where to send this person's personal cards.
  await db.from("profiles").update({ teams_ref: { serviceUrl: a.serviceUrl, conversationId: a.conversation.id } }).eq("id", me.id);

  if (a.type === "invoke" && a.name === "adaptiveCard/action") {
    const verb = a.value?.action?.verb, d = a.value?.action?.data || {};
    let text = "Done.";
    if (verb === "ticket.done" && d.id) { await db.from("tickets").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", d.id); await db.from("activity").insert({ entity_type: "ticket", entity_id: d.id, actor_id: me.id, verb: "changed", data: { field: "status", to: "done", via: "teams" } }); text = "Marked done."; }
    if (verb === "ticket.snooze" && d.id) { const { data: t } = await db.from("tickets").select("due_on").eq("id", d.id).single(); await db.from("tickets").update({ due_on: addDays(t?.due_on ?? todayISO(), 1) }).eq("id", d.id); text = "Snoozed one day."; }
    if ((verb === "expense.approve" || verb === "expense.reject") && d.id) {
      const { data: p } = await db.from("profiles").select("team_role,functions").eq("id", me.id).single();
      const { data: ex } = await db.from("expenses").select("created_by").eq("id", d.id).maybeSingle();
      if (ex?.created_by === me.id && p?.team_role !== "owner") text = "You can't decide your own expense.";
      else if (p && (p.team_role !== "member" || (p.functions as string[]).includes("finance"))) { await db.from("expenses").update({ status: verb === "expense.approve" ? "approved" : "rejected", approver_id: me.id, decided_at: new Date().toISOString() }).eq("id", d.id); text = verb === "expense.approve" ? "Approved." : "Rejected."; }
      else text = "Only Finance can decide expenses.";
    }
    if (verb === "comment" && d.id && d.comment) await db.from("comments").insert({ entity_type: d.type || "ticket", entity_id: d.id, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: d.comment }] }] }, created_by: me.id });
    return Response.json({ statusCode: 200, type: "application/vnd.microsoft.activity.message", value: text });
  }

  if (a.type === "message" && a.text) {
    // Stand-up answers in chat: "done: ... / next: ... / blockers: ..." (any order), or a single line saved as "next".
    const t = a.text.replace(/<[^>]+>/g, "").trim();
    const part = (k: string) => new RegExp(`${k}\\s*[:：]\\s*([^\\n]+)`, "i").exec(t)?.[1]?.trim() ?? "";
    const row = { done: part("done") || part("خلّصت"), next: part("next") || part("الحين") || (/[:：]/.test(t) ? "" : t), blockers: part("blockers") || part("عوائق") };
    await db.from("standups").upsert({ profile_id: me.id, day: todayISO(), ...row, via: "teams" }, { onConflict: "profile_id,day" });
    return Response.json({ type: "message", text: "Thanks, your stand-up is in." });
  }
  return new Response(null, { status: 200 });
}
