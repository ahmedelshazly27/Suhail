import { agentAuth, buildBrief, kuwait, scheduledNow, shiftAt, type Agent } from "@/lib/agents";
import { supabaseAdmin } from "@/lib/supabase/server";

// A sub-agent starts its run here: a run is opened and its brief comes back as Markdown.
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await agentAuth(req))) return new Response("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const { data } = await db.from("agents").select("*").eq("key", (await params).key).maybeSingle();
  if (!data) return new Response("No such agent", { status: 404 });
  const agent = data as Agent;
  const k = kuwait();
  const scheduled = scheduledNow(agent);
  const { count: asks } = await db.from("agent_requests").select("id", { count: "exact", head: true }).eq("agent_key", agent.key).eq("status", "open");
  const reason = [scheduled ? "your scheduled run" : "", agent.run_requested_at ? "a teammate asked for a run" : "", asks ? `${asks} request${asks === 1 ? "" : "s"} waiting` : ""].filter(Boolean).join(", ") || "a manual run";
  const { data: run, error } = await db.from("agent_runs").insert({ agent_key: agent.key, shift: shiftAt(k.hour) }).select("id").single();
  if (error) return new Response(error.message, { status: 500 });
  await db.from("agents").update({ run_requested_at: null, ...(scheduled ? { last_scheduled_on: k.date } : {}) }).eq("key", agent.key);
  return new Response(await buildBrief(agent, run.id, reason), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
}
