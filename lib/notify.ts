import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { teams } from "@/lib/m365";

type Note = { kind: string; title: string; body?: string; entity_type?: string; entity_id?: string; href?: string };

/** In-app notification for specific people, plus a personal Teams card when the bot is set up. */
export async function notifyPeople(profileIds: string[], n: Note) {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!ids.length) return;
  await supabaseAdmin().from("notifications").insert(ids.map((profile_id) => ({ profile_id, ...n })));
  await Promise.allSettled(ids.map((id) => teams().personal(id, { title: n.title, text: n.body ?? "", href: n.href })));
}

/** Everyone on the team who should hear about new applications: owners and admins. Also posts to the Teams channel. */
export async function notifyTeam(n: Note) {
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("active", true).in("team_role", ["owner", "admin"]);
  await notifyPeople((data || []).map((p) => p.id), n);
  await teams().channel({ title: n.title, text: n.body ?? "", href: n.href }).catch(() => {});
}
