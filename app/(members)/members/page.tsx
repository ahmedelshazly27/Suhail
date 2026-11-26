import Link from "next/link";
import { MemberCard, Section } from "@/components/members/Card";
import { homeDates, MEMBER_COLS, picks, requireMember, type Member } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const me = await requireMember();
  const t = mt(me.lang);
  const db = await supabaseServer();
  const { today, soon, week } = homeDates();
  const [{ data: all }, { data: trips }, { data: posts }] = await Promise.all([
    db.from("members").select(MEMBER_COLS).eq("status", "active").order("joined_at", { ascending: false }).limit(2000),
    db.from("member_trips").select("id,member_id,city,country,starts_on,ends_on,note").gte("ends_on", today).lte("starts_on", soon).order("starts_on").limit(60),
    db.from("member_posts").select("id,kind,title,city,happens_at,created_at,member_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const members = (all || []) as Member[], byId = new Map(members.map((m) => [m.id, m]));
  const fresh = members.filter((m) => m.id !== me.id && m.joined_at >= week).slice(0, 12);
  const mine = me.city.toLowerCase();
  const travel = (trips || []).filter((x) => x.member_id !== me.id && byId.has(x.member_id)).sort((a, b) => Number(b.city.toLowerCase() === mine) - Number(a.city.toLowerCase() === mine));
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(me.lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="mb-stack">
      <Section title={t.picks} sub={t.picksSub} more={{ href: "/members/people", label: t.seeAll }}>
        <div className="mb-row">{picks(me, members, today).map((m) => <MemberCard key={m.id} m={m} t={t} />)}</div>
        {members.length < 2 ? <p className="s">{t.nobodyYet}</p> : null}
      </Section>
      <Section title={t.newWeek} sub={t.newWeekSub}>
        {fresh.length ? <div className="mb-row">{fresh.map((m) => <MemberCard key={m.id} m={m} t={t} />)}</div> : <p className="s">{t.nobodyYet}</p>}
      </Section>
      <Section title={t.travel} sub={t.travelSub} more={{ href: "/members/me#trips", label: t.addTrip }}>
        {travel.length ? <div className="mb-row">{travel.map((x) => <MemberCard key={x.id} m={byId.get(x.member_id)!} t={t} note={`${x.city} · ${fmt(x.starts_on)}–${fmt(x.ends_on)}${x.city.toLowerCase() === mine ? ` · ${t.comingTo}` : ""}`} />)}</div> : <p className="s">{t.nobodyYet}</p>}
      </Section>
      <Section title={t.fromBoard} more={{ href: "/members/board", label: t.seeAll }}>
        <div className="card">{(posts || []).map((p) => <Link key={p.id} href={`/members/board/${p.id}`} className="row mb-post-row"><span className="chip">{t.kinds[p.kind]}</span><span className="ell">{p.title}</span><span className="s">{byId.get(p.member_id)?.name}</span></Link>)}</div>
        {!posts?.length ? <p className="s">{t.nobodyYet}</p> : null}
      </Section>
    </div>
  );
}
