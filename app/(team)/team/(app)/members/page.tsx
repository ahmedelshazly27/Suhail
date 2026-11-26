import { MembersAdmin } from "@/components/team/MembersAdmin";
import { isAdmin, requireMe } from "@/lib/auth";
import { membersUrl } from "@/lib/members";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Members" };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, { data: apps }, { data: members }, { data: requests }, { data: opps }] = await Promise.all([teamPrefs(),
    db.from("member_applications").select("id,name,email,role,building,link,city,status,created_at").order("created_at", { ascending: false }).limit(300),
    db.from("members").select("id,name,headline,role,city,country,status,joined_at").order("joined_at", { ascending: false }).limit(2000),
    db.from("member_requests").select("id,kind,target,body,status,answer,created_at,member:members(name,headline)").order("created_at", { ascending: false }).limit(300),
    db.from("member_opportunities").select("id,kind,title,org,body,url,deadline,location,tags,published").order("created_at", { ascending: false }).limit(500)]);
  return <MembersAdmin lang={lang} apps={apps || []} members={members || []} requests={(requests || []) as never} opps={opps || []} admin={isAdmin(me)} url={membersUrl()} />;
}
