import { MembersAdmin } from "@/components/team/MembersAdmin";
import { isAdmin, requireMe } from "@/lib/auth";
import { membersUrl } from "@/lib/members";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Members" };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, { data: apps }, { data: members }] = await Promise.all([teamPrefs(),
    db.from("member_applications").select("id,name,email,role,building,link,city,status,created_at").order("created_at", { ascending: false }).limit(300),
    db.from("members").select("id,name,headline,role,city,country,status,joined_at").order("joined_at", { ascending: false }).limit(2000)]);
  return <MembersAdmin lang={lang} apps={apps || []} members={members || []} admin={isAdmin(me)} url={membersUrl()} />;
}
