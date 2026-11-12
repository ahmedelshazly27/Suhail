import { agentAuth, reportSchema } from "@/lib/agents";
import { notifyPeople } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/server";

// A sub-agent reports its run: drafts land in the review queue for the desk owner (or whoever asked), requests it
// answered are closed, and the people who review hear about it once.
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await agentAuth(req))) return new Response("Unauthorized", { status: 401 });
  const key = (await params).key;
  const parsed = reportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, fix: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const r = parsed.data;
  const db = supabaseAdmin();
  const [{ data: agent }, { data: run }] = await Promise.all([
    db.from("agents").select("key,name,owner_id").eq("key", key).maybeSingle(),
    db.from("agent_runs").select("id,status").eq("id", r.run_id).eq("agent_key", key).maybeSingle(),
  ]);
  if (!agent || !run) return Response.json({ ok: false, fix: ["run_id does not belong to this agent"] }, { status: 400 });
  if (run.status !== "running") return Response.json({ ok: false, fix: ["this run was already reported"] }, { status: 409 });
  const now = new Date().toISOString();

  if (r.failed) {
    await db.from("agent_runs").update({ status: "failed", error: r.failed, summary: r.summary, finished_at: now }).eq("id", run.id);
    return Response.json({ ok: true, saved: 0 });
  }

  // Answers go to whoever asked; everything else to the desk owner (null: the founders).
  const reqIds = [...new Set(r.items.map((i) => i.request_id).filter(Boolean))] as string[];
  const { data: asks } = reqIds.length ? await db.from("agent_requests").select("id,created_by").eq("agent_key", key).in("id", reqIds) : { data: [] };
  const asker = new Map((asks || []).map((a) => [a.id, a.created_by as string | null]));
  const rows = r.items.map((i) => {
    const rid = i.request_id && asker.has(i.request_id) ? i.request_id : null;
    return { agent_key: key, run_id: run.id, request_id: rid, kind: i.kind, title: i.title, body: i.body, data: i.data, sources: i.sources, score: i.score ?? null, for_id: rid ? asker.get(rid) ?? agent.owner_id : agent.owner_id };
  });
  if (rows.length) {
    const { error } = await db.from("agent_items").insert(rows);
    if (error) return Response.json({ ok: false, fix: [error.message] }, { status: 400 });
  }
  if (reqIds.length) await db.from("agent_requests").update({ status: "answered", answered_at: now }).in("id", [...asker.keys()]).eq("status", "open");
  await Promise.all([
    db.from("agent_runs").update({ status: "done", summary: r.summary, items: rows.length, finished_at: now }).eq("id", run.id),
    db.from("agents").update({ last_run_at: now, ...(r.lessons !== undefined && r.lessons.trim() ? { lessons: r.lessons } : {}) }).eq("key", key),
  ]);

  if (rows.length) {
    const founders = rows.some((x) => !x.for_id) ? ((await db.from("profiles").select("id").eq("active", true).eq("team_role", "owner")).data || []).map((p) => p.id as string) : [];
    const byPerson = new Map<string, number>();
    for (const row of rows) for (const id of row.for_id ? [row.for_id] : founders) byPerson.set(id, (byPerson.get(id) || 0) + 1);
    await Promise.all([...byPerson].map(([id, n]) => notifyPeople([id], { kind: "agent", title: `${agent.name}: ${n} new for you to review`, body: r.summary.slice(0, 200), href: "/team/agents" })));
  }
  return Response.json({ ok: true, saved: rows.length });
}
