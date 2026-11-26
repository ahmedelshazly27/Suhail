import { Relationships, type Rel } from "@/components/team/Relationships";
import { SectionTabs } from "@/components/team/SectionTabs";
import { requireMe } from "@/lib/auth";
import { signatureText } from "@/lib/email/signature";
import { m365Live } from "@/lib/m365/graph";
import { getShell } from "@/lib/data/shell";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Relationships" };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, shell, { data }] = await Promise.all([teamPrefs(), getShell(me.id),
    db.from("relationships").select("id,name,type,stage,owner_id,next_step,next_due,project_ids,value,last_contact_at,last_contact_via,contact:contacts(name,email),events:relationship_events(what,via,happened_at)").order("next_due", { ascending: true, nullsFirst: false })]);
  type Row = Omit<Rel, "contact"> & { contact: Rel["contact"] | Rel["contact"][] };
  const rows: Rel[] = ((data || []) as unknown as Row[]).map((r) => ({ ...r, contact: Array.isArray(r.contact) ? r.contact[0] ?? null : r.contact, events: [...r.events].sort((a, b) => b.happened_at.localeCompare(a.happened_at)) }));
  return <><SectionTabs lang={lang} group="relationships" /><Relationships lang={lang} rows={rows} people={shell.people} projects={shell.projects} signature={signatureText(me)} canEmail={m365Live()} /></>;
}
