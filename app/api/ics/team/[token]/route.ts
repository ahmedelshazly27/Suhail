import { env } from "@/lib/env";
import { ics, teamToken } from "@/lib/ics";
import { supabaseAdmin } from "@/lib/supabase/server";

// Team feed: project deadlines and event days, sprints and published content dates.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  if ((await params).token.replace(/\.ics$/, "") !== teamToken()) return new Response("Not found", { status: 404 });
  const db = supabaseAdmin();
  const [p, s, c] = await Promise.all([
    db.from("projects").select("id,name,slug,target_date").not("target_date", "is", null).neq("status", "done"),
    db.from("sprints").select("id,number,starts_on,ends_on").neq("status", "done"),
    db.from("content_items").select("id,title,channel,publish_on").in("status", ["approved", "scheduled", "published"]).not("publish_on", "is", null),
  ]);
  const base = env.teamUrl();
  return new Response(ics("Suhail team", [
    ...(p.data || []).map((x) => ({ uid: `p-${x.id}`, date: x.target_date!, title: x.name, url: `${base}/team/projects/${x.slug}` })),
    ...(s.data || []).map((x) => ({ uid: `s-${x.id}`, date: x.starts_on, end: x.ends_on, title: `Sprint ${x.number}` })),
    ...(c.data || []).map((x) => ({ uid: `c-${x.id}`, date: x.publish_on!, title: `${x.channel}: ${x.title}` })),
  ]), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" } });
}
