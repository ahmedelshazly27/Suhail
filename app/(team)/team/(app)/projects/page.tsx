import Link from "next/link";
import { NewProject } from "@/components/team/NewProject";
import { requireMe } from "@/lib/auth";
import { dueLabel } from "@/lib/dates";
import { getShell } from "@/lib/data/shell";
import { supabaseServer } from "@/lib/supabase/server";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const me = await requireMe();
  const { lang } = await teamPrefs();
  const db = await supabaseServer();
  const [{ data: projects }, { data: counts }, shell, { data: templates }] = await Promise.all([
    db.from("projects").select("id,slug,name,lead_id,status,target_date,budget,currency").order("sort").order("created_at"),
    db.from("tickets").select("project_id,status").is("deleted_at", null).not("project_id", "is", null),
    getShell(me.id), db.from("project_templates").select("key,name").order("name"),
  ]);
  const prog = (id: string) => { const all = (counts || []).filter((t) => t.project_id === id && t.status !== "cancelled"); return { done: all.filter((t) => t.status === "done").length, total: all.length }; };
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">{tt(lang, "workspace")}</span><h1>{tt(lang, "projects")}</h1></div><NewProject lang={lang} people={shell.people} templates={templates || []} /></header>
      <div className="tbl-wrap" tabIndex={0}><table className="tbl">
        <thead><tr><th>{tt(lang, "name")}</th><th>{tt(lang, "lead")}</th><th>{tt(lang, "status")}</th><th>{tt(lang, "target")}</th><th style={{ width: "14rem" }}>{lang === "ar" ? "التقدّم" : "Progress"}</th></tr></thead>
        <tbody>{(projects || []).map((p) => { const g = prog(p.id), pct = g.total ? Math.round((g.done / g.total) * 100) : 0, d = dueLabel(lang, p.target_date); return (
          <tr key={p.id}><td><Link href={`/team/projects/${p.slug}`} style={{ textDecoration: "none", fontWeight: 500 }}>{p.name}</Link></td>
            <td>{shell.people.find((x) => x.id === p.lead_id)?.name ?? ""}</td><td>{p.status}</td><td className={`due ${d.cls}`}>{d.text}</td>
            <td><span style={{ display: "flex", alignItems: "center", gap: ".625rem" }}><span className="num muted">{pct}%</span><span className="track" style={{ flex: 1 }}><span style={{ width: pct + "%" }} /></span></span></td></tr>); })}</tbody>
      </table></div>
    </>
  );
}
