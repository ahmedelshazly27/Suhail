import { Relationships, type Rel } from "@/components/team/Relationships";
import { requireMe } from "@/lib/auth";
import { getShell } from "@/lib/data/shell";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Relationships" };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, shell, { data }] = await Promise.all([teamPrefs(), getShell(me.id),
    db.from("relationships").select("id,name,type,stage,owner_id,next_step,next_due,project_ids,value,last_contact_at,last_contact_via,events:relationship_events(what,via,happened_at)").order("next_due", { ascending: true, nullsFirst: false })]);
  const rows = ((data || []) as Rel[]).map((r) => ({ ...r, events: [...r.events].sort((a, b) => b.happened_at.localeCompare(a.happened_at)) }));
  return <Relationships lang={lang} rows={rows} people={shell.people} projects={shell.projects} />;
}
