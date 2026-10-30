import "server-only";
import { delegatedToken, graph, m365Live } from "./graph";
import { supabaseAdmin } from "@/lib/supabase/server";

export type DirPerson = { id: string; name: string; email: string; jobTitle: string };
export interface DirectoryProvider { readonly live: boolean; search(q: string): Promise<DirPerson[]> }

/** Organisation directory (User.ReadBasic.All) for assignees, owners and @mentions. */
class GraphDirectory implements DirectoryProvider {
  live = true;
  constructor(private token: string) {}
  async search(q: string) {
    const j = await graph<{ value: { id: string; displayName: string; mail: string; jobTitle: string }[] }>(this.token, `/users?$search="displayName:${q.replace(/"/g, "")}"&$select=id,displayName,mail,jobTitle&$top=10`, { headers: { ConsistencyLevel: "eventual" } });
    return j.value.map((u) => ({ id: u.id, name: u.displayName, email: u.mail, jobTitle: u.jobTitle || "" }));
  }
}
/** Until Microsoft 365 is connected, the directory is the team's own profiles. */
class ProfileDirectory implements DirectoryProvider {
  live = false;
  async search(q: string) {
    const { data } = await supabaseAdmin().from("profiles").select("id,name,email,job_title").eq("active", true).ilike("name", `%${q}%`).limit(10);
    return (data || []).map((p) => ({ id: p.id, name: p.name, email: p.email, jobTitle: p.job_title }));
  }
}
export async function directory(profileId: string): Promise<DirectoryProvider> {
  if (m365Live()) { const t = await delegatedToken(profileId); if (t) return new GraphDirectory(t); }
  return new ProfileDirectory();
}
