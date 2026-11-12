import { agentAuth, agentsPaused, kuwait, scheduledNow, shiftAt, shiftPlan, type Agent } from "@/lib/agents";
import { syncDefaults } from "@/lib/agent-defaults";
import { supabaseAdmin } from "@/lib/supabase/server";

// The routine calls this a few times a day and gets back, as plain text, which agents to run now and how.
// Due: scheduled today at or before this shift and not run yet today, asked to run at the next shift, or with an open
// request from a teammate. Runs that never reported back are closed as failed.
export async function GET(req: Request) {
  if (!(await agentAuth(req))) return new Response("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  await syncDefaults().catch(() => {});
  await db.from("agent_runs").update({ status: "failed", error: "Did not report back", finished_at: new Date().toISOString() })
    .eq("status", "running").lt("started_at", new Date(Date.now() - 3 * 3600e3).toISOString());
  const k = kuwait();
  const shift = shiftAt(k.hour);
  if (await agentsPaused()) return text(`# Suhail agent shift (${shift}, ${k.date})\n\nThe agent team is paused in the dashboard. Reply "Agents paused" and stop.`);
  const [{ data: agents }, { data: asks }] = await Promise.all([
    db.from("agents").select("*").eq("enabled", true).order("sort"),
    db.from("agent_requests").select("agent_key").eq("status", "open"),
  ]);
  const asked = new Set((asks || []).map((r) => r.agent_key));
  const due = ((agents || []) as Agent[]).filter((a) => a.run_requested_at || asked.has(a.key) || scheduledNow(a));
  return text(shiftPlan(due, shift, k.date));
}
export const POST = GET;

const text = (s: string) => new Response(s, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
