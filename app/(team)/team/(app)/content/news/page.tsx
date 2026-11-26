import { NewsDesk, type Story } from "@/components/team/NewsDesk";
import { SectionTabs } from "@/components/team/SectionTabs";
import { requireMe } from "@/lib/auth";
import { daysAgo, POOL_KINDS } from "@/lib/agents";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "News" };

export default async function Page() {
  await requireMe();
  const db = await supabaseServer();
  const [{ lang }, { data }, { data: agents }] = await Promise.all([teamPrefs(),
    db.from("agent_items").select("id,agent_key,kind,title,body,score,status,created_at,sources").in("kind", [...POOL_KINDS]).neq("agent_key", "coach").gte("created_at", daysAgo(186)).order("created_at", { ascending: false }).limit(800),
    db.from("agents").select("key,name,name_ar")]);
  const names = Object.fromEntries((agents || []).map((a) => [a.key, lang === "ar" && a.name_ar ? a.name_ar : a.name]));
  return (
    <>
      <SectionTabs lang={lang} group="content" />
      <NewsDesk lang={lang} stories={((data || []) as Story[]).map((s) => ({ ...s, sources: Array.isArray(s.sources) ? s.sources : [] }))} agents={names} />
    </>
  );
}
