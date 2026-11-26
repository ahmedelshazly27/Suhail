import Link from "next/link";
import { forMember, homeDates, OPP_COLS, requireMember, type Opportunity } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Opportunities" };
const KINDS = ["perk", "grant", "job", "event", "call"] as const;

export default async function Opportunities({ searchParams }: PageProps<"/members/opportunities">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const kind = String((await searchParams).kind ?? "");
  const { today } = homeDates();
  const { data } = await (await supabaseServer()).from("member_opportunities").select(OPP_COLS).or(`deadline.is.null,deadline.gte.${today}`).limit(300);
  const list = forMember(me, (data || []) as Opportunity[]).filter((o) => !kind || o.kind === kind);
  const mine = new Set([...me.skills, ...me.looking_for].map((s) => s.toLowerCase()));
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(me.lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mb-stack">
      <div><h1 className="mb-h1">{t.opps}</h1><p className="mb-lede">{t.oppsLede}</p></div>
      <div className="mb-chips"><Link href="/members/opportunities" className={`pill-s${!kind ? " on" : ""}`} aria-current={!kind ? "page" : undefined}>{t.seeAll}</Link>{KINDS.map((k) => <Link key={k} href={`/members/opportunities?kind=${k}`} className={`pill-s${kind === k ? " on" : ""}`} aria-current={kind === k ? "page" : undefined}>{t.oppKinds[k]}</Link>)}</div>
      {list.length ? <div className="mb-opps">{list.map((o) => (
        <article key={o.id} className="card pad mb-opp">
          <span className="mb-post-k"><span className="chip">{t.oppKinds[o.kind]}</span>{o.tags.some((x) => mine.has(x)) ? <span className="chip attn">{t.forYou}</span> : null}<span className="s">{o.org}{o.location ? ` · ${o.location}` : ""}</span></span>
          <h2 dir="auto">{o.title}</h2>
          {o.body ? <p dir="auto">{o.body}</p> : null}
          <span className="row-btns">{o.url ? <a className="b" href={o.url} target="_blank" rel="noopener noreferrer">{t.apply2}</a> : null}{o.deadline ? <span className="s">{t.deadline} {fmt(o.deadline)}</span> : null}</span>
        </article>
      ))}</div> : <p className="s">{t.noOpps}</p>}
    </div>
  );
}
