import { notFound } from "next/navigation";
import { IntroForm } from "@/components/members/Forms";
import { Avatar } from "@/components/ui/Avatar";
import { MEMBER_COLS, requireMember, type Member } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Person({ params }: PageProps<"/members/people/[id]">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabaseServer();
  const [{ data }, { data: asked }] = await Promise.all([
    db.from("members").select(MEMBER_COLS).eq("id", id).eq("status", "active").maybeSingle(),
    db.from("member_intros").select("status").eq("from_id", me.id).eq("to_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!data) notFound();
  const m = data as Member;
  const links = Object.entries(m.links || {}).filter(([, u]) => typeof u === "string" && /^https:\/\//.test(u));
  return (
    <article className="mb-narrow mb-profile">
      <Avatar name={m.name} src={m.avatar_url} size="lg" />
      <h1 className="mb-h1">{m.name}</h1>
      <p className="mb-lede">{m.headline || t.roles[m.role]}{m.company && !m.headline ? ` · ${m.company}` : ""}</p>
      <p className="s">{[t.roles[m.role], m.city, m.country].filter(Boolean).join(" · ")}</p>
      {m.building ? <p className="mb-building" dir="auto">{m.building}</p> : null}
      {m.looking_for.length ? <div><span className="sect-h">{t.lookingFor}</span><div className="mb-chips">{m.looking_for.map((l) => <span key={l} className="chip attn">{t.looking[l]}</span>)}</div></div> : null}
      {m.skills.length ? <div><span className="sect-h">{t.skills}</span><div className="mb-chips">{m.skills.map((s) => <span key={s} className="chip" dir="ltr">{s}</span>)}</div></div> : null}
      {links.length ? <div className="mb-chips">{links.map(([k, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer nofollow" className="pill-s">{k === "x" ? "X" : k === "github" ? "GitHub" : k === "linkedin" ? "LinkedIn" : "Website"}</a>)}</div> : null}
      {m.id === me.id ? null : asked?.status === "pending" ? <p className="mb-ok" role="status">{t.introPending}. {t.introSent}</p> : m.open_to_intros ? <IntroForm t={t} to={m.id} /> : <p className="s">{t.notOpen}</p>}
    </article>
  );
}
