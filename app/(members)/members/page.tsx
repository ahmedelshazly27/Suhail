import Link from "next/link";
import { MemberCard, Photo, Section } from "@/components/members/Card";
import { ShipBox } from "@/components/members/Forms";
import { forMember, homeDates, MEMBER_COLS, OPP_COLS, photos, picks, requireMember, streak, type Member, type Opportunity } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

type Post = { id: string; kind: string; title: string; link: string | null; body: string; created_at: string; member_id: string };

export default async function Home() {
  const me = await requireMember();
  const t = mt(me.lang);
  const db = await supabaseServer();
  const { today, soon, week } = homeDates();
  const month = new Date(Date.parse(week) - 23 * 864e5).toISOString();
  const [{ data: all }, { data: trips }, { data: posts }, { data: opps }, { data: mine }] = await Promise.all([
    db.from("members").select(MEMBER_COLS).eq("status", "active").order("joined_at", { ascending: false }).limit(2000),
    db.from("member_trips").select("id,member_id,city,country,starts_on,ends_on,note").gte("ends_on", today).lte("starts_on", soon).order("starts_on").limit(60),
    db.from("member_posts").select("id,kind,title,link,body,created_at,member_id").is("deleted_at", null).in("kind", ["shipped", "ask"]).gte("created_at", month).order("created_at", { ascending: false }).limit(200),
    db.from("member_opportunities").select(OPP_COLS).or(`deadline.is.null,deadline.gte.${today}`).limit(200),
    db.from("member_posts").select("created_at").eq("member_id", me.id).eq("kind", "shipped").is("deleted_at", null).order("created_at", { ascending: false }).limit(60),
  ]);
  const members = (all || []) as Member[], byId = new Map(members.map((m) => [m.id, m]));
  const pics = await photos(members);
  const ps = (posts || []) as Post[];
  const shipped = ps.filter((p) => p.kind === "shipped" && p.created_at >= week && byId.has(p.member_id)).slice(0, 8);
  const skills = new Set([...me.skills, me.role.toLowerCase()].map((s) => s.toLowerCase()));
  const asks = ps.filter((p) => p.kind === "ask" && p.member_id !== me.id && [...skills].some((s) => s.length > 1 && `${p.title} ${p.body}`.toLowerCase().includes(s))).slice(0, 4);
  const fresh = members.filter((m) => m.id !== me.id && m.joined_at >= week).slice(0, 12);
  const here = me.city.toLowerCase();
  const travel = (trips || []).filter((x) => x.member_id !== me.id && byId.has(x.member_id)).sort((a, b) => Number(b.city.toLowerCase() === here) - Number(a.city.toLowerCase() === here));
  const top = forMember(me, (opps || []) as Opportunity[]).slice(0, 3);
  const run = streak((mine || []).map((p) => p.created_at));
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(me.lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const shippedMe = (mine || []).some((p) => p.created_at >= week);
  return (
    <div className="mb-stack">
      <div className="mb-hello">
        <h1 className="mb-h1">{t.greeting} {me.name.split(" ")[0]}</h1>
        {run ? <span className="chip attn">{run === 1 ? t.streak1 : t.streakMany.replace("{n}", String(run))}</span> : null}
      </div>
      <div className="mb-split">
        <section className="card pad mb-ship">
          <h2>{t.shipQ}</h2>
          {shippedMe ? <p className="s">{t.shipNudge}</p> : null}
          <ShipBox t={t} />
          {!shippedMe ? <p className="s">{t.shipNudge}</p> : null}
        </section>
        <section className="card pad mb-forme">
          <div className="mb-sec-h"><h2>{t.opps}</h2><Link href="/members/opportunities" className="s">{t.seeAll}</Link></div>
          {top.length ? top.map((o) => (
            <a key={o.id} href={o.url ?? "/members/opportunities"} target={o.url ? "_blank" : undefined} rel="noopener noreferrer" className="mb-opp-row">
              <span className="chip">{t.oppKinds[o.kind]}</span><span className="stack-t"><span>{o.title}</span><span className="s">{o.org}{o.deadline ? ` · ${t.deadline} ${fmt(o.deadline)}` : ""}</span></span>
            </a>
          )) : <p className="s">{t.noOpps}</p>}
          <Link href="/members/ask" className="b quiet">{t.ask}</Link>
        </section>
      </div>
      <Section title={t.picks} sub={t.picksSub} more={{ href: "/members/people", label: t.seeAll }}>
        {members.length > 1 ? <div className="mb-row">{picks(me, members, today).map((m) => <MemberCard key={m.id} m={m} t={t} src={pics[m.id]} />)}</div> : <p className="s">{t.nobodyYet}</p>}
      </Section>
      {shipped.length ? <Section title={t.shippedThisWeek} more={{ href: "/members/board?kind=shipped", label: t.seeAll }}>
        <div className="mb-feed">{shipped.map((p) => { const a = byId.get(p.member_id)!; return (
          <Link key={p.id} href={`/members/board/${p.id}`} className="mb-feed-row"><Photo m={a} src={pics[a.id]} className="mb-photo sm" /><span className="stack-t"><span>{p.title}</span><span className="s">{a.name}{a.company ? ` · ${a.company}` : ""}</span></span></Link>
        ); })}</div>
      </Section> : null}
      {asks.length ? <Section title={t.helpAsks} sub={t.helpAsksSub}>
        <div className="mb-feed">{asks.map((p) => { const a = byId.get(p.member_id); return a ? (
          <Link key={p.id} href={`/members/board/${p.id}`} className="mb-feed-row"><Photo m={a} src={pics[a.id]} className="mb-photo sm" /><span className="stack-t"><span>{p.title}</span><span className="s">{a.name}</span></span></Link>
        ) : null; })}</div>
      </Section> : null}
      <Section title={t.travel} sub={t.travelSub} more={{ href: "/members/me#trips", label: t.addTrip }}>
        {travel.length ? <div className="mb-row">{travel.map((x) => <MemberCard key={x.id} m={byId.get(x.member_id)!} t={t} src={pics[x.member_id]} note={`${x.city} · ${fmt(x.starts_on)} – ${fmt(x.ends_on)}${x.city.toLowerCase() === here ? ` · ${t.comingTo}` : ""}`} />)}</div> : <p className="s">{t.nobodyYet}</p>}
      </Section>
      {fresh.length ? <Section title={t.newWeek} sub={t.newWeekSub}><div className="mb-row">{fresh.map((m) => <MemberCard key={m.id} m={m} t={t} src={pics[m.id]} />)}</div></Section> : null}
    </div>
  );
}
