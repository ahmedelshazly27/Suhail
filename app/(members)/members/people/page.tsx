import { MemberCard } from "@/components/members/Card";
import { LOOKING, MEMBER_COLS, requireMember, ROLES, search, type Member } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "People" };

export default async function People({ searchParams }: PageProps<"/members/people">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const sp = await searchParams;
  const q = String(sp.q ?? ""), role = String(sp.role ?? ""), want = String(sp.looking ?? "");
  const { data } = await (await supabaseServer()).from("members").select(MEMBER_COLS).eq("status", "active").order("joined_at", { ascending: false }).limit(2000);
  const list = search((data || []) as Member[], q).filter((m) => m.id !== me.id && (!role || m.role === role) && (!want || m.looking_for.includes(want)));
  return (
    <div className="mb-stack">
      <form className="mb-search" role="search">
        <input name="q" className="inp" defaultValue={q} placeholder={t.search} aria-label={t.search} dir="auto" />
        <select name="role" defaultValue={role} aria-label={t.role}><option value="">{t.role}</option>{ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</select>
        <select name="looking" defaultValue={want} aria-label={t.lookingFor}><option value="">{t.lookingFor}</option>{LOOKING.map((r) => <option key={r} value={r}>{t.looking[r]}</option>)}</select>
        <button className="b">{t.search.split(/[,،]/)[0]}</button>
      </form>
      <p className="s">{t.searchHelp} · {list.length} {t.results}</p>
      <div className="mb-grid">{list.map((m) => <MemberCard key={m.id} m={m} t={t} />)}</div>
    </div>
  );
}
