import Link from "next/link";
import { AddMilestone, GateChecklist, KpiActions, MilestoneItem, ReviewForm, WhyPanel } from "@/components/team/Plan";
import { Avatar } from "@/components/ui/Avatar";
import { isAdmin, requireMe } from "@/lib/auth";
import { getShell } from "@/lib/data/shell";
import { drive, type DriveItem } from "@/lib/m365/drive";
import { DEPARTMENTS, deptLabel, fmtKpi, getPlan, PLAN_YEARS, planQuarter, type Gate, type Kpi, type PlanSnapshot } from "@/lib/plan";
import { supabaseServer } from "@/lib/supabase/server";
import { tt, type TLang } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Plan" };
const TABS = ["why", "roadmap", "kpis", "reviews"] as const;
type Tab = (typeof TABS)[number];
const TAB_L: Record<Tab, [string, string]> = { why: ["Why", "ليش"], roadmap: ["Roadmap", "خارطة الطريق"], kpis: ["KPIs", "المؤشرات"], reviews: ["Reviews", "المراجعات"] };
const L = (lang: TLang, en: string, ar: string) => (lang === "ar" ? ar : en);

/** Twelve monthly points as a small line; ink when on track, orange when at risk. */
function Spark({ points, risk }: { points: number[]; risk: boolean }) {
  const max = Math.max(1, ...points), w = 120, h = 28;
  const d = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg className={`spark${risk ? " risk" : ""}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}

function KpiCard({ k, lang, year, people, canEdit, meId }: { k: Kpi; lang: TLang; year: number; people: { id: string; name: string }[]; canEdit: boolean; meId: string }) {
  const target = k.targets[year] ?? 0;
  const pct = target ? Math.min(100, Math.round(((k.actual ?? 0) / target) * 100)) : 0;
  const owner = people.find((p) => p.id === k.owner_id);
  return (
    <div className="card pad kpi">
      <div className="kpi-h"><h2>{lang === "ar" ? k.name_ar : k.name_en}</h2><span className="key">{k.source === "auto" ? L(lang, "Automatic", "تلقائي") : L(lang, "Manual", "يدوي")}</span></div>
      <div className="kpi-v"><span className="num big-n">{fmtKpi(k.unit, k.actual)}</span><span className="muted">{tt(lang, "of")} {fmtKpi(k.unit, target)}</span>
        <span className={`chip${k.onTrack ? "" : " attn"}`}>{k.onTrack ? L(lang, "On track", "ماشي تمام") : L(lang, "At risk", "فيه خطر")}</span></div>
      <span className={`track${k.onTrack ? " ink" : ""}`} role="img" aria-label={`${pct}%`}><span style={{ width: pct + "%" }} /></span>
      <Spark points={k.trend} risk={!k.onTrack} />
      <div className="kpi-f">
        <span className="key">{[1, 2, 3, 4].filter((q) => k.checkpoints[q] !== undefined).map((q) => `Q${q} ${fmtKpi(k.unit, k.checkpoints[q])}`).join(" · ")}</span>
        <span className="key">{PLAN_YEARS.filter((y) => y !== year && k.targets[y] !== undefined).map((y) => `${y} ${fmtKpi(k.unit, k.targets[y])}`).join(" · ")}</span>
      </div>
      <div className="kpi-f">
        <span className="muted owner">{owner ? <><Avatar name={owner.name} /> {owner.name.split(" ")[0]}</> : L(lang, "No owner yet", "ما له مسؤول")}</span>
        <KpiActions lang={lang} kpi={{ id: k.id, name: lang === "ar" ? k.name_ar : k.name_en, unit: k.unit, source: k.source, owner_id: k.owner_id, targets: k.targets, checkpoints: k.checkpoints, history: k.history }}
          people={people} canEdit={canEdit} canEnter={k.source === "manual" && (canEdit || k.owner_id === meId)} year={year} />
      </div>
    </div>
  );
}

function GateBadge({ g, lang }: { g: Gate; lang: TLang }) {
  const met = g.criteria.filter((c) => c.met).length;
  return <span className={`gate-b${g.criteria.length && met === g.criteria.length ? " met" : ""}`} title={g.title}><span className="vh-sr">{L(lang, "Gate", "بوابة")}: </span>{g.title} · {met}/{g.criteria.length}</span>;
}

export default async function PlanPage({ searchParams }: PageProps<"/team/plan">) {
  const me = await requireMe();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "roadmap";
  const threeYears = sp.view === "3y";
  const db = await supabaseServer();
  const [{ lang }, shell, plan, d, { data: reviews }, { data: tickets }] = await Promise.all([
    teamPrefs(), getShell(me.id), getPlan(), drive(me.id),
    tab === "reviews" ? db.from("plan_reviews").select("id,year,quarter,snapshot,went_well,went_badly,will_change,created_at,created_by").order("year", { ascending: false }).order("quarter", { ascending: false }) : Promise.resolve({ data: [] }),
    tab === "roadmap" ? db.from("tickets").select("id,key,title,status").is("deleted_at", null).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
  ]);
  const docs: DriveItem[] | null = await d.listPath("Team/Plan").catch(() => null);
  const canEdit = isAdmin(me);
  const { year } = plan;
  const { quarter, started } = planQuarter(year);
  const qms = plan.milestones.filter((m) => m.quarter === quarter);
  const planDoc = docs?.find((f) => f.kind === "DOC" || f.kind === "PDF"), deck = docs?.find((f) => f.kind === "PPT");
  const people = shell.people.map((p) => ({ id: p.id, name: p.name }));
  const depts = [...DEPARTMENTS, ...[...new Set(plan.milestones.map((m) => m.department))].filter((x) => !DEPARTMENTS.includes(x))];
  const qGates = (q: number) => plan.gates.filter((g) => g.year === year && g.after_quarter === q);
  const ticketOpts = (tickets || []).map((t) => ({ id: t.id, label: `${t.key} ${t.title}`, done: t.status === "done" }));

  return (
    <>
      <div className="dither dither-strip" aria-hidden="true" />
      <header className="ph">
        <div className="ph-t">
          <span className="eb">{tt(lang, "plan")}</span>
          <h1>{L(lang, `Plan ${year}`, `خطة ${year}`)}</h1>
          <div className="ph-meta">
            <span><b>Q{quarter}</b> {started ? "" : L(lang, "(starts 1 January)", "(تبدأ ١ يناير)")}</span>
            <span><b className="num">{qms.filter((m) => m.status === "done").length}</b> {tt(lang, "of")} {qms.length} {L(lang, "milestones done", "إنجازات خلصت")}</span>
          </div>
        </div>
        <div className="ph-actions">
          {planDoc ? <a className="b quiet" href={planDoc.webUrl} target="_blank" rel="noreferrer">{L(lang, "Plan document", "وثيقة الخطة")}</a> : null}
          {deck ? <a className="b quiet" href={deck.webUrl} target="_blank" rel="noreferrer">{L(lang, "Deck", "العرض")}</a> : null}
          {!planDoc || !deck ? <Link className="b ghost" href="/team/drive">{L(lang, "Add the document and deck to Team/Plan", "حط الوثيقة والعرض في Team/Plan")}</Link> : null}
        </div>
      </header>

      <nav className="tabs-u" aria-label={tt(lang, "plan")}>
        {TABS.map((t) => <Link key={t} href={`?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{L(lang, ...TAB_L[t])}</Link>)}
        {tab === "roadmap" ? <span className="end"><Link href={threeYears ? "?tab=roadmap" : "?tab=roadmap&view=3y"} className="pill-s" aria-current={threeYears ? "true" : undefined}>{L(lang, "Three years", "ثلاث سنوات")}</Link></span> : null}
      </nav>

      {tab === "why" ? <WhyPanel lang={lang} why={plan.why} canEdit={canEdit} people={shell.people} /> : null}

      {tab === "roadmap" && !threeYears ? (
        <>
          <div className="pgrid" role="table" aria-label={L(lang, `Roadmap ${year}`, `خارطة الطريق ${year}`)}>
            <div className="pg-row pg-head" role="row">
              <span role="columnheader" className="pg-dept"><span className="vh-sr">{L(lang, "Department", "القسم")}</span></span>
              {[1, 2, 3, 4].map((q) => (
                <span key={q} role="columnheader" className={`pg-q${q === quarter && started ? " now" : ""}`}>
                  <b>Q{q}</b> <span className="muted">{[L(lang, "Jan to Mar", "يناير إلى مارس"), L(lang, "Apr to Jun", "أبريل إلى يونيو"), L(lang, "Jul to Sep", "يوليو إلى سبتمبر"), L(lang, "Oct to Dec", "أكتوبر إلى ديسمبر")][q - 1]}</span>
                  {qGates(q).map((g) => <GateBadge key={g.id} g={g} lang={lang} />)}
                </span>
              ))}
            </div>
            {depts.map((dep) => (
              <div key={dep} className="pg-row" role="row">
                <span role="rowheader" className="pg-dept">{deptLabel(lang, dep)}</span>
                {[1, 2, 3, 4].map((q) => (
                  <div key={q} role="cell" className="pg-cell">
                    <span className="pg-ql">Q{q}</span>
                    {plan.milestones.filter((m) => m.department === dep && m.quarter === q).map((m) => (
                      <MilestoneItem key={m.id} lang={lang} m={m} people={people} projects={shell.projects} tickets={ticketOpts} canEdit={canEdit || m.owner_id === me.id} isAdmin={canEdit} />
                    ))}
                    {canEdit ? <AddMilestone lang={lang} department={dep} quarter={q} year={year} people={people} projects={shell.projects} tickets={ticketOpts} /> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <section className="gates" aria-label={L(lang, "Gates", "البوابات")}>
            <h2 className="sect-t">{L(lang, "Gates", "البوابات")}</h2>
            <div className="gate-grid">{plan.gates.map((g) => (
              <GateChecklist key={g.id} lang={lang} gate={g} canEdit={canEdit}
                when={g.after_quarter ? L(lang, `End of Q${g.after_quarter} ${g.year}`, `نهاية الربع ${g.after_quarter} من ${g.year}`) : L(lang, `Into ${g.year}`, `قبل ${g.year}`)} />
            ))}</div>
          </section>
        </>
      ) : null}

      {tab === "roadmap" && threeYears ? (
        <div className="years">
          {PLAN_YEARS.map((y, i) => {
            const into = plan.gates.filter((g) => g.year === y && !g.after_quarter);
            return (
              <div key={y} className="years-step">
                {i > 0 ? <div className="years-gate">{into.map((g) => <GateBadge key={g.id} g={g} lang={lang} />)}</div> : null}
                <div className={`card pad${y === year ? "" : " soft"}`}>
                  <h2 style={{ font: "300 1.75rem/1.1 var(--f-display)" }}>{y}</h2>
                  {y === year ? <span className="muted" style={{ fontSize: ".8125rem" }}>{plan.milestones.filter((m) => m.status === "done").length} {tt(lang, "of")} {plan.milestones.length} {L(lang, "milestones done", "إنجازات خلصت")}</span> : null}
                  <ul className="years-k">{plan.kpis.filter((k) => k.targets[y] !== undefined).map((k) => <li key={k.id}><span>{lang === "ar" ? k.name_ar : k.name_en}</span><span className="num">{fmtKpi(k.unit, k.targets[y])}</span></li>)}</ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "kpis" ? (
        <div className="kpi-grid">{plan.kpis.map((k) => <KpiCard key={k.id} k={k} lang={lang} year={year} people={people} canEdit={canEdit} meId={me.id} />)}</div>
      ) : null}

      {tab === "reviews" ? (
        <div className="col" style={{ maxWidth: "52rem" }}>
          {canEdit ? <ReviewForm lang={lang} year={year} quarter={started ? quarter : 1} taken={(reviews || []).filter((r) => r.year === year).map((r) => r.quarter)} /> : null}
          {(reviews || []).length ? (reviews || []).map((r) => {
            const s = r.snapshot as PlanSnapshot;
            const count = (st: string) => s.milestones.filter((m) => m.status === st).length;
            return (
              <article key={r.id} className="card pad review">
                <div className="kpi-h"><h2>Q{r.quarter} {r.year}</h2><span className="key">{new Intl.DateTimeFormat(lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { dateStyle: "medium" }).format(new Date(r.created_at))} · {shell.people.find((p) => p.id === r.created_by)?.name ?? ""}</span></div>
                <p className="muted" style={{ fontSize: ".8125rem", margin: 0 }}>{count("done")} {L(lang, "done", "خلص")} · {count("on_track")} {L(lang, "on track", "ماشي تمام")} · {count("at_risk")} {L(lang, "at risk", "فيه خطر")} · {count("not_started")} {L(lang, "not started", "ما بدأ")}</p>
                {[[L(lang, "What went well", "وش مشى زين"), r.went_well], [L(lang, "What didn't", "وش ما مشى"), r.went_badly], [L(lang, "What we change", "وش بنغيّر"), r.will_change]].map(([h, t]) => (
                  <div key={h}><h3 className="sect-t">{h}</h3><p className="pre" dir="auto">{t || "–"}</p></div>
                ))}
                <details><summary>{L(lang, "Snapshot", "اللقطة")}</summary>
                  <div className="tbl-wrap" tabIndex={0}><table className="tbl"><tbody>{s.kpis.map((k) => (
                    <tr key={k.key}><td>{lang === "ar" ? k.name_ar : k.name_en}</td><td className="n">{fmtKpi(k.unit, k.actual)}</td><td className="n muted">{fmtKpi(k.unit, k.target)}</td><td>{k.onTrack ? L(lang, "On track", "ماشي تمام") : L(lang, "At risk", "فيه خطر")}</td></tr>
                  ))}</tbody></table></div>
                  <ul className="snap-gates">{s.gates.map((g) => <li key={g.title}>{g.title}: {g.met}/{g.total}</li>)}</ul>
                </details>
              </article>
            );
          }) : <p className="muted">{L(lang, "No reviews yet. One is due in the last week of each quarter.", "ما فيه مراجعات للحين. وحدة كل آخر أسبوع من الربع.")}</p>}
        </div>
      ) : null}
    </>
  );
}
