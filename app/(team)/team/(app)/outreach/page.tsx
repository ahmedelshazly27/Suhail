import { Outreach, type OutRow } from "@/components/team/Outreach";
import { isAdmin, requireMe } from "@/lib/auth";
import { signatureText } from "@/lib/email/signature";
import { m365Live } from "@/lib/m365/graph";
import { PACK } from "@/lib/outreach-pack";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Outreach" };

type Raw = Omit<OutRow, "rel"> & { rel: { name: string; stage: string; type: string; contact: { email: string | null } | { email: string | null }[] | null } };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, { data }] = await Promise.all([teamPrefs(),
    db.from("outreach").select("id,relationship_id,segment,priority,country,website,why_them,why_us,ask,programs,sources,contact_name,contact_role,linkedin,email_source,form_url,subject,body,status,sent_at,rel:relationships(name,stage,type,contact:contacts(email))").order("priority")]);
  const rows: OutRow[] = ((data || []) as unknown as Raw[]).map(({ rel, ...r }) => {
    const c = Array.isArray(rel.contact) ? rel.contact[0] : rel.contact;
    return { ...r, sources: Array.isArray(r.sources) ? r.sources : [], rel: { name: rel.name, stage: rel.stage, type: rel.type, email: c?.email ?? null } };
  });
  return <Outreach lang={lang} rows={rows} packSize={PACK.entries.length} admin={isAdmin(me)} canEmail={m365Live()} signature={signatureText(me)} />;
}
