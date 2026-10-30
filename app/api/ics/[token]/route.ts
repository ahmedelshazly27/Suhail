import { env } from "@/lib/env";
import { ics } from "@/lib/ics";
import { supabaseAdmin } from "@/lib/supabase/server";

// Private calendar feed: my due dates, sprint dates and content I own. Subscribe once in Outlook.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{36}$/.test(token)) return new Response("Not found", { status: 404 });
  const db = supabaseAdmin();
  const { data: me } = await db.from("profiles").select("id,name,active").eq("ics_token", token).maybeSingle();
  if (!me?.active) return new Response("Not found", { status: 404 });
  const [t, s, c] = await Promise.all([
    db.from("tickets").select("id,key,title,due_on").eq("assignee_id", me.id).is("deleted_at", null).not("due_on", "is", null).not("status", "in", "(done,cancelled)"),
    db.from("sprints").select("id,number,starts_on,ends_on").neq("status", "done"),
    db.from("content_items").select("id,title,channel,publish_on").eq("owner_id", me.id).not("publish_on", "is", null),
  ]);
  const base = env.teamUrl();
  const body = ics(`Suhail · ${me.name}`, [
    ...(t.data || []).map((x) => ({ uid: `t-${x.id}`, date: x.due_on!, title: `${x.key} ${x.title}`, url: `${base}/team/tickets/${x.key}` })),
    ...(s.data || []).map((x) => ({ uid: `s-${x.id}`, date: x.starts_on, end: x.ends_on, title: `Sprint ${x.number}`, url: `${base}/team/sprints` })),
    ...(c.data || []).map((x) => ({ uid: `c-${x.id}`, date: x.publish_on!, title: `${x.channel}: ${x.title}`, url: `${base}/team/content` })),
  ]);
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" } });
}
