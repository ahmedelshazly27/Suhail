import Link from "next/link";
import { createIssue } from "@/app/actions/newsletter";
import { requireMe } from "@/lib/auth";
import { ago } from "@/lib/dates";
import { supabaseServer } from "@/lib/supabase/server";
import { tt, type TKey } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Newsletter" };

export default async function Page({ searchParams }: PageProps<"/team/newsletter">) {
  await requireMe();
  const tab = (await searchParams).tab === "subscribers" ? "subscribers" : "issues";
  const db = await supabaseServer();
  const [{ lang }, { data: issues }, { data: events }, { data: subs }, counts] = await Promise.all([teamPrefs(),
    db.from("newsletter_issues").select("id,number,title,status,sent_at,scheduled_at,segment,updated_at").order("created_at", { ascending: false }),
    db.from("email_events").select("issue_id,type,email").not("issue_id", "is", null),
    tab === "subscribers" ? db.from("subscribers").select("id,email,lang,status,sources,created_at,confirmed_at").order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    db.from("subscribers").select("lang,status")]);
  const stat = (id: string, t: string) => new Set((events || []).filter((e) => e.issue_id === id && e.type === t).map((e) => e.email)).size;
  const c = (l: string, s = "active") => (counts.data || []).filter((x) => x.lang === l && x.status === s).length;
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">Resend · {c("ar")} {tt(lang, "arabic")} · {c("en")} {tt(lang, "english")}</span><h1>{tt(lang, "newsletter")}</h1></div><form action={createIssue}><button className="b" type="submit">{tt(lang, "compose")}</button></form></header>
      <nav className="tabs-u"><Link href="?tab=issues" aria-current={tab === "issues" ? "page" : undefined}>{tt(lang, "issues")}</Link><Link href="?tab=subscribers" aria-current={tab === "subscribers" ? "page" : undefined}>{tt(lang, "subscribers")} <span className="key">{(counts.data || []).length}</span></Link></nav>
      {tab === "issues" ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>#</th><th>{lang === "ar" ? "العنوان" : "Title"}</th><th>{tt(lang, "status")}</th><th>{tt(lang, "segment")}</th><th className="n">{tt(lang, "delivered")}</th><th className="n">{tt(lang, "opened")}</th><th className="n">{tt(lang, "bounced")}</th><th className="n">{tt(lang, "complained")}</th></tr></thead>
          <tbody>{(issues || []).map((i) => (
            <tr key={i.id}><td className="key">{i.number}</td><td><Link href={`/team/newsletter/${i.id}`} style={{ textDecoration: "none" }}>{i.title}</Link></td>
              <td><span className={`chip${i.status === "scheduled" ? " attn" : ""}`}>{i.status}{i.sent_at ? ` · ${ago(lang, i.sent_at)}` : ""}</span></td><td>{i.segment}</td>
              <td className="n">{stat(i.id, "email.delivered") || ""}</td><td className="n">{stat(i.id, "email.opened") || ""}</td><td className="n">{stat(i.id, "email.bounced") || ""}</td><td className="n">{stat(i.id, "email.complained") || ""}</td></tr>))}</tbody>
        </table></div>
      ) : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>{tt(lang, "emailAddr")}</th><th>{tt(lang, "language2")}</th><th>{tt(lang, "status")}</th><th>{lang === "ar" ? "المصدر" : "Source"}</th><th className="n">{tt(lang, "when")}</th></tr></thead>
          <tbody>{(subs || []).map((s) => <tr key={s.id} style={{ cursor: "default" }}><td dir="ltr">{s.email}</td><td>{s.lang.toUpperCase()}</td><td><span className="chip">{tt(lang, s.status as TKey)}</span></td><td>{(s.sources || []).join(", ")}</td><td className="n">{ago(lang, s.created_at)}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
