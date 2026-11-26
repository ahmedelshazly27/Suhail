import { notFound } from "next/navigation";
import { IntroForm } from "@/components/members/Forms";
import Link from "next/link";
import { Photo } from "@/components/members/Card";
import { MEMBER_COLS, photos, requireMember, streak, type Member } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Person({ params }: PageProps<"/members/people/[id]">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabaseServer();
  const [{ data }, { data: asked }, { data: ships }] = await Promise.all([
    db.from("members").select(MEMBER_COLS).eq("id", id).eq("status", "active").maybeSingle(),
    db.from("member_intros").select("status").eq("from_id", me.id).eq("to_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("member_posts").select("id,title,created_at").eq("member_id", id).eq("kind", "shipped").is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!data) notFound();
  const m = data as Member;
  const pic = (await photos([m]))[m.id];
  const run = streak((ships || []).map((x) => x.created_at));
  const links = Object.entries(m.links || {}).filter(([, u]) => typeof u === "string" && /^https:\/\//.test(u));
  return (
    <article className="mb-narrow mb-profile">
      <div className="mb-hero"><Photo m={m} src={pic} className="mb-photo xl" /><div><h1 className="mb-h1">{m.name}</h1>
      <p className="mb-lede">{m.headline || t.roles[m.role]}{m.company && !m.headline ? ` · ${m.company}` : ""}</p>
      <p className="s">{[t.roles[m.role], m.city, m.country].filter(Boolean).join(" · ")}</p>{run ? <span className="chip attn">{run === 1 ? t.streak1 : t.streakMany.replace("{n}", String(run))}</span> : null}</div></div>
      {m.building ? <p className="mb-building" dir="auto">{m.building}</p> : null}
      {m.looking_for.length ? <div><span className="sect-h">{t.lookingFor}</span><div className="mb-chips">{m.looking_for.map((l) => <span key={l} className="chip attn">{t.looking[l]}</span>)}</div></div> : null}
      {m.skills.length ? <div><span className="sect-h">{t.skills}</span><div className="mb-chips">{m.skills.map((s) => <span key={s} className="chip" dir="ltr">{s}</span>)}</div></div> : null}
      {ships?.length ? <div><span className="sect-h">{t.shipped2}</span><div className="mb-feed">{ships.slice(0, 5).map((x) => <Link key={x.id} href={`/members/board/${x.id}`} className="mb-feed-row"><span className="stack-t"><span>{x.title}</span><span className="s">{x.created_at.slice(0, 10)}</span></span></Link>)}</div></div> : null}
      {links.length ? <div className="mb-chips">{links.map(([k, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer nofollow" className="pill-s">{k === "x" ? "X" : k === "github" ? "GitHub" : k === "linkedin" ? "LinkedIn" : "Website"}</a>)}</div> : null}
      {m.id === me.id ? null : asked?.status === "pending" ? <p className="mb-ok" role="status">{t.introPending}. {t.introSent}</p> : m.open_to_intros ? <IntroForm t={t} to={m.id} /> : <p className="s">{t.notOpen}</p>}
    </article>
  );
}
