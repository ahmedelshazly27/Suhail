import Link from "next/link";
import { IntroDecide, ShowEmail } from "@/components/members/Forms";
import { requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Introductions" };
type I = { id: string; note: string; status: string; created_at: string; from: { id: string; name: string; headline: string } | null; to: { id: string; name: string; headline: string } | null; from_id: string };

export default async function Intros() {
  const me = await requireMember();
  const t = mt(me.lang);
  const { data } = await (await supabaseServer()).from("member_intros").select("id,note,status,created_at,from_id,from:members!member_intros_from_id_fkey(id,name,headline),to:members!member_intros_to_id_fkey(id,name,headline)").order("created_at", { ascending: false });
  const rows = (data || []) as unknown as I[];
  const inc = rows.filter((r) => r.from_id !== me.id), out = rows.filter((r) => r.from_id === me.id);
  const label = (s: string) => (s === "accepted" ? t.accepted : s === "declined" ? t.declined : t.pending);
  const row = (r: I, other: I["from"]) => (
    <div key={r.id} className="card pad">
      <span className="mb-post-k"><Link href={`/members/people/${other?.id}`}><strong>{other?.name}</strong></Link><span className="s">{other?.headline}</span><span className={`chip${r.status === "accepted" ? " attn" : ""}`}>{label(r.status)}</span></span>
      <p dir="auto">{r.note}</p>
      {r.status === "pending" && r.from_id !== me.id ? <IntroDecide t={t} id={r.id} /> : null}
      {r.status === "accepted" ? <p className="s">{t.introAcceptedNote} <ShowEmail id={r.id} /></p> : null}
    </div>
  );
  return (
    <div className="mb-stack mb-narrow">
      <h1 className="mb-h1">{t.intros}</h1>
      <h2 className="sect-h">{t.incoming}</h2>{inc.length ? inc.map((r) => row(r, r.from)) : <p className="s">{t.nobodyYet}</p>}
      <h2 className="sect-h">{t.outgoing}</h2>{out.length ? out.map((r) => row(r, r.to)) : <p className="s">{t.nobodyYet}</p>}
    </div>
  );
}
