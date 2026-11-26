import Link from "next/link";
import { PostForm } from "@/components/members/Forms";
import { POST_KINDS, requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Board" };

export default async function Board({ searchParams }: PageProps<"/members/board">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const kind = String((await searchParams).kind ?? "");
  let q = (await supabaseServer()).from("member_posts").select("id,kind,title,body,city,happens_at,created_at,author:members!member_posts_member_id_fkey(name),comments:member_comments(count),likes:member_reactions(count)").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if ((POST_KINDS as readonly string[]).includes(kind)) q = q.eq("kind", kind);
  const { data } = await q;
  type Row = { id: string; kind: string; title: string; body: string; city: string; happens_at: string | null; created_at: string; author: { name: string } | null; comments: { count: number }[]; likes: { count: number }[] };
  return (
    <div className="mb-stack">
      <details className="card pad mb-new"><summary>{t.newPost}</summary><PostForm t={t} /></details>
      <div className="mb-chips"><Link href="/members/board" className={`pill-s${!kind ? " on" : ""}`} aria-current={!kind ? "page" : undefined}>{t.seeAll}</Link>{POST_KINDS.map((k) => <Link key={k} href={`/members/board?kind=${k}`} className={`pill-s${kind === k ? " on" : ""}`} aria-current={kind === k ? "page" : undefined}>{t.kinds[k]}</Link>)}</div>
      <div className="mb-posts">{((data || []) as unknown as Row[]).map((p) => (
        <Link key={p.id} href={`/members/board/${p.id}`} className="card pad mb-post">
          <span className="mb-post-k"><span className="chip">{t.kinds[p.kind]}</span><span className="s">{p.author?.name}</span>{p.happens_at ? <span className="s">{new Date(p.happens_at).toLocaleString(me.lang === "ar" ? "ar" : "en-GB", { dateStyle: "medium", timeStyle: "short" })} · {p.city}</span> : null}</span>
          <h2 dir="auto">{p.title}</h2>
          {p.body ? <p className="mb-clip" dir="auto">{p.body}</p> : null}
          <span className="s">♡ {p.likes[0]?.count ?? 0} · {t.comment} {p.comments[0]?.count ?? 0}</span>
        </Link>
      ))}</div>
      {!data?.length ? <p className="s">{t.nobodyYet}</p> : null}
    </div>
  );
}
