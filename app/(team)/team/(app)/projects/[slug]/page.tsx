import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectDoc } from "@/components/team/ProjectDoc";
import { TicketsView } from "@/components/team/TicketsView";
import { StatusDot } from "@/components/ui/Status";
import { requireMe } from "@/lib/auth";
import { dueLabel } from "@/lib/dates";
import { ticketCtx } from "@/lib/data/ctx";
import { getProject } from "@/lib/data/tickets";
import { getView } from "@/lib/data/views";
import { supabaseServer } from "@/lib/supabase/server";
import { tt, type TKey } from "@/lib/team-i18n";

const TABS = ["board", "table", "timeline", "docs", "files", "budget"] as const;

export async function generateMetadata({ params }: PageProps<"/team/projects/[slug]">) {
  return { title: decodeURIComponent((await params).slug).replace(/-/g, " ") };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/team/projects/[slug]">) {
  const me = await requireMe();
  const { slug } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof TABS)[number]) : "board";
  const [data, ctx] = await Promise.all([getProject(slug), ticketCtx(me)]);
  if (!data) notFound();
  const { project: p, tickets, spent } = data;
  const { lang, people, sprints } = ctx;
  const live = tickets.filter((t) => t.status !== "cancelled");
  const pct = live.length ? Math.round((live.filter((t) => t.status === "done").length / live.length) * 100) : 0;
  const d = dueLabel(lang, p.target_date);
  const active = sprints.find((s) => s.status === "active");
  const view = await getView(me.id, `project:${p.id}`, { layout: tab === "table" ? "table" : "board", group_by: "status", filters: {}, sort: [] });
  const db = await supabaseServer();
  const [files, expenses, tpl] = await Promise.all([
    tab === "files" ? db.from("file_links").select("id,name,web_url,entity_type,created_at").or(`and(entity_type.eq.project,entity_id.eq.${p.id}),entity_id.in.(${tickets.map((t) => t.id).join(",") || "00000000-0000-0000-0000-000000000000"})`) : Promise.resolve({ data: [] }),
    tab === "budget" ? db.from("expenses").select("id,description,amount,currency,status,spent_on,created_by").eq("project_id", p.id).order("spent_on", { ascending: false }) : Promise.resolve({ data: [] }),
    p.template_key ? db.from("project_templates").select("name").eq("key", p.template_key).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <header className="ph" style={{ alignItems: "flex-end" }}>
        <div className="ph-t">
          <span className="eb"><Link href="/team/projects" style={{ textDecoration: "none" }}>{tt(lang, "projects")}</Link> / {(tpl.data as { name: string } | null)?.name ?? p.status}</span>
          <h1>{p.name}</h1>
        </div>
        <div className="ph-meta">
          <span>{tt(lang, "lead")} <b>{people.find((x) => x.id === p.lead_id)?.name.split(" ")[0] ?? ""}</b></span>
          {p.target_date ? <span>{tt(lang, "target")} <b className={`due ${d.cls}`}>{d.text}</b></span> : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}><span className="num">{pct}%</span><span className="track" style={{ width: "5.5rem" }}><span style={{ width: pct + "%" }} /></span></span>
          {p.budget ? <span>{tt(lang, "budget")} {p.currency} {spent.toLocaleString("en")} {tt(lang, "of")} {Number(p.budget).toLocaleString("en")}</span> : null}
        </div>
      </header>
      <nav className="tabs-u" aria-label={p.name}>
        {TABS.map((t) => <Link key={t} href={`?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{t === "files" ? `${tt(lang, "files")} (SharePoint)` : tt(lang, t as TKey)}</Link>)}
        <span className="end">{tt(lang, "group")}: {tt(lang, "status")}{active ? ` · ${tt(lang, "sprint")} ${active.number}` : ""}</span>
      </nav>
      {tab === "board" || tab === "table" ? (
        <TicketsView key={tab} tickets={tickets} ctx={ctx} list={`project:${p.id}`} view={{ ...view, layout: tab === "table" ? "table" : view.layout }} defaults={{ project_id: p.id, sprint_id: active?.id }} hideBacklog={tab === "board"} />
      ) : tab === "timeline" ? (
        <div className="card">{[...live].filter((t) => t.due_on).sort((a, b) => a.due_on!.localeCompare(b.due_on!)).map((t) => { const dd = dueLabel(lang, t.due_on); return (
          <Link key={t.id} href={`?tab=board&t=${t.key}`} className="row" style={{ gridTemplateColumns: "6rem 14px 4rem minmax(0,1fr) auto" }}>
            <span className={`due ${dd.cls}`}>{t.due_on}</span><StatusDot s={t.status} /><span className="key">{t.key}</span><span className="ell">{t.title}</span><span className="muted" style={{ fontSize: ".75rem" }}>{people.find((x) => x.id === t.assignee_id)?.name ?? ""}</span>
          </Link>); })}</div>
      ) : tab === "docs" ? (
        <ProjectDoc id={p.id} doc={p.doc} lang={lang} people={people} />
      ) : tab === "files" ? (
        <div className="card">
          <div className="card-h"><h2>{tt(lang, "files")}</h2>{p.sharepoint_folder_url ? <a href={p.sharepoint_folder_url} target="_blank" rel="noreferrer" style={{ fontSize: ".75rem" }}>{lang === "ar" ? "افتح المجلد في SharePoint" : "Open folder in SharePoint"}</a> : <Link href="/team/drive" style={{ fontSize: ".75rem" }}>{tt(lang, "drive")}</Link>}</div>
          {(files.data || []).length ? (files.data as { id: string; name: string; web_url: string }[]).map((f) => <a key={f.id} href={f.web_url} target="_blank" rel="noreferrer" className="row" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>{f.name}</a>) : <div className="card-f">{tt(lang, "emptyList")}</div>}
        </div>
      ) : (
        <div className="card">
          <div className="card-h"><h2>{tt(lang, "budget")}</h2><span className="num">{p.currency} {spent.toLocaleString("en")} / {Number(p.budget ?? 0).toLocaleString("en")}</span></div>
          {(expenses.data as { id: string; description: string; amount: number; currency: string; status: string; spent_on: string }[]).map((e) => (
            <div key={e.id} className="row" style={{ gridTemplateColumns: "6rem minmax(0,1fr) auto auto" }}><span className="due">{e.spent_on}</span><span className="ell">{e.description}</span><span className="chip">{tt(lang, e.status as TKey)}</span><span className="num">{e.currency} {Number(e.amount).toLocaleString("en")}</span></div>
          ))}
          <div className="card-f"><Link href="/team/finance">{tt(lang, "submitExpense")}</Link></div>
        </div>
      )}
    </>
  );
}
