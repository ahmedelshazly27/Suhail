import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm, DeletePost, Toggle } from "@/components/members/Forms";
import { requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Post({ params }: PageProps<"/members/board/[id]">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabaseServer();
  const [{ data: p }, { data: comments }, { data: likes }, { data: rsvps }] = await Promise.all([
    db.from("member_posts").select("id,member_id,kind,title,body,link,city,happens_at,created_at,author:members!member_posts_member_id_fkey(id,name,headline)").eq("id", id).is("deleted_at", null).maybeSingle(),
    db.from("member_comments").select("id,body,created_at,author:members(id,name)").eq("post_id", id).order("created_at"),
    db.from("member_reactions").select("member_id").eq("post_id", id),
    db.from("member_rsvps").select("member_id,who:members(name)").eq("post_id", id),
  ]);
  if (!p) notFound();
  const author = p.author as unknown as { id: string; name: string; headline: string } | null;
  const going = (rsvps || []) as unknown as { member_id: string; who: { name: string } | null }[];
  return (
    <article className="mb-narrow mb-stack">
      <span className="mb-post-k"><span className="chip">{t.kinds[p.kind]}</span>{author ? <Link href={`/members/people/${author.id}`} className="s">{author.name}</Link> : null}</span>
      <h1 className="mb-h1" dir="auto">{p.title}</h1>
      {p.happens_at ? <p className="mb-lede">{new Date(p.happens_at).toLocaleString(me.lang === "ar" ? "ar" : "en-GB", { dateStyle: "full", timeStyle: "short" })} · {p.city}</p> : null}
      {p.body ? <p className="mb-building" dir="auto">{p.body}</p> : null}
      {p.link && /^https:\/\//.test(p.link) ? <a href={p.link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{p.link}</a> : null}
      <div className="row-btns">
        <Toggle table="member_reactions" postId={p.id} on={!!likes?.some((l) => l.member_id === me.id)} label="♡" count={likes?.length ?? 0} />
        {p.kind === "meetup" ? <Toggle table="member_rsvps" postId={p.id} on={going.some((g) => g.member_id === me.id)} label={t.rsvp} count={going.length} /> : null}
        {p.member_id === me.id ? <DeletePost t={t} id={p.id} /> : null}
      </div>
      {p.kind === "meetup" && going.length ? <p className="s">{t.going}: {going.map((g) => g.who?.name).filter(Boolean).join("، ")}</p> : null}
      <div className="feed">{((comments || []) as unknown as { id: string; body: string; author: { id: string; name: string } | null }[]).map((c) => (
        <div key={c.id} className="mb-c"><Link href={`/members/people/${c.author?.id}`} className="s">{c.author?.name}</Link><p dir="auto">{c.body}</p></div>
      ))}</div>
      <CommentForm t={t} postId={p.id} />
    </article>
  );
}
