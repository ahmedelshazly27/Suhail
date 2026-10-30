import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type Person = { id: string; name: string; email: string; avatar_url: string | null; job_title: string; team_role: string; functions: string[] };
export type ProjectLite = { id: string; slug: string; name: string; status: string };

/** Everything the sidebar and pickers need, in one round of parallel queries. */
export const getShell = cache(async (meId: string) => {
  const db = await supabaseServer();
  const [people, projects, unread, newApps, pendingExp, projCount] = await Promise.all([
    db.from("profiles").select("id,name,email,avatar_url,job_title,team_role,functions").eq("active", true).order("name"),
    db.from("projects").select("id,slug,name,status").in("status", ["active", "planned"]).order("sort").order("created_at"),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", meId).is("read_at", null),
    db.from("applications").select("id", { count: "exact", head: true }).eq("stage", "New").is("deleted_at", null),
    db.from("expenses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("projects").select("id", { count: "exact", head: true }).neq("status", "done"),
  ]);
  return {
    people: (people.data || []) as Person[],
    projects: (projects.data || []) as ProjectLite[],
    counts: { inbox: unread.count ?? 0, applications: newApps.count ?? 0, finance: pendingExp.count ?? 0, projects: projCount.count ?? 0 },
  };
});
