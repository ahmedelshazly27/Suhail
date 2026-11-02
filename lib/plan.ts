import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

// The yearly plan: milestones by department and quarter, gates between quarters, KPIs against targets.
// Automatic KPIs are counted from the tables the team already works in, on every read; a nightly snapshot keeps
// their history for the trend lines. Manual KPIs are whatever their owner last entered.

export const PLAN_YEAR = 2027;
export const PLAN_YEARS = [2027, 2028, 2029];
export const DEPARTMENTS = ["Team", "Partnerships", "Events", "Editorial", "Engineering and Research", "Finance"];
const DEPT_AR: Record<string, string> = { Team: "الفريق", Partnerships: "الشراكات", Events: "الفعاليات", Editorial: "التحرير", "Engineering and Research": "الهندسة والبحث", Finance: "المالية" };
export const deptLabel = (lang: "ar" | "en", d: string) => (lang === "ar" ? DEPT_AR[d] ?? d : d);

export const MILESTONE_STATUSES = ["not_started", "on_track", "at_risk", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type Milestone = { id: string; year: number; quarter: number; department: string; title: string; owner_id: string | null; status: MilestoneStatus; project_ids: string[]; ticket_ids: string[]; sort: number; done_at: string | null; ticketsDone?: boolean };
export type Criterion = { id: string; gate_id: string; text: string; met: boolean; sort: number };
export type Gate = { id: string; year: number; after_quarter: number | null; title: string; sort: number; criteria: Criterion[] };
export type KpiUnit = "count" | "percent" | "usd";
export type Kpi = {
  id: string; key: string; name_en: string; name_ar: string; unit: KpiUnit; source: "auto" | "manual"; owner_id: string | null; sort: number;
  targets: Record<number, number>;               // year -> yearly target
  checkpoints: Record<number, number>;           // quarter -> checkpoint for the plan year
  actual: number | null; expected: number; onTrack: boolean; trend: number[];
  history: { value: number; on_date: string; note: string; created_by: string | null }[];
};
export type Why = { mission?: unknown; vision?: unknown; principles?: unknown };

/** The quarter the plan is in today; before the year starts, the first quarter (not started yet). */
export function planQuarter(year = PLAN_YEAR, now = new Date()) {
  const y = now.getUTCFullYear();
  if (y < year) return { quarter: 1, started: false };
  if (y > year) return { quarter: 4, started: true };
  return { quarter: Math.floor(now.getUTCMonth() / 3) + 1, started: true };
}

/** How much of the year has passed, 0 to 1. */
export function yearElapsed(year = PLAN_YEAR, now = new Date()) {
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/** Last day of a quarter, as YYYY-MM-DD. */
export const quarterEnd = (year: number, q: number) => new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);

const inYear = (year: number) => [`${year}-01-01`, `${year + 1}-01-01`] as const;

/** Automatic KPI values for a year, counted from the dashboard's own tables (service role: totals only). */
export async function autoValues(year = PLAN_YEAR): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  const [from, to] = inYear(year);
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [subscribers, participants, partners, talent, episodes, income] = await Promise.all([
    count(db.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("form_key", "hack").eq("stage", "Accepted").is("deleted_at", null).gte("created_at", from).lt("created_at", to)),
    count(db.from("relationships").select("id", { count: "exact", head: true }).in("type", ["Sponsor", "Partner"]).in("stage", ["Confirmed", "Active"])),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("form_key", "talent").is("deleted_at", null)),
    count(db.from("content_items").select("id", { count: "exact", head: true }).eq("channel", "podcast").eq("status", "published").gte("publish_on", from).lt("publish_on", to)),
    db.from("income").select("amount_usd").gte("received_on", from).lt("received_on", to),
  ]);
  const revenue = (income.data || []).reduce((n, r) => n + Number(r.amount_usd), 0);
  return { subscribers, hackathon_participants: participants, partners, talent_pool: talent, episodes, revenue };
}

/** The value the straight line from zero to the yearly target expects today (a rate is expected at its target). */
export function expectedNow(unit: KpiUnit, target: number, year = PLAN_YEAR, now = new Date()) {
  return unit === "percent" ? target : target * yearElapsed(year, now);
}

/** Last value on or before each of the last 12 month ends, oldest first. */
function monthlyTrend(history: { value: number; on_date: string }[], current: number | null, now = new Date()) {
  const sorted = [...history].sort((a, b) => a.on_date.localeCompare(b.on_date));
  const out: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0)).toISOString().slice(0, 10);
    const last = sorted.filter((v) => v.on_date <= end).pop();
    out.push(last ? Number(last.value) : 0);
  }
  if (current !== null) out[11] = current;
  return out;
}

export async function getKpis(year = PLAN_YEAR, now = new Date()): Promise<Kpi[]> {
  const db = supabaseAdmin();
  const since = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const [{ data: kpis }, { data: targets }, { data: values }, auto] = await Promise.all([
    db.from("kpis").select("id,key,name_en,name_ar,unit,source,owner_id,sort").order("sort"),
    db.from("kpi_targets").select("kpi_id,year,quarter,target"),
    db.from("kpi_values").select("kpi_id,value,on_date,note,created_by,source").gte("on_date", since).order("on_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
    autoValues(year),
  ]);
  const { started } = planQuarter(year, now);
  return (kpis || []).map((k) => {
    const t = (targets || []).filter((x) => x.kpi_id === k.id);
    const yearly = Object.fromEntries(t.filter((x) => x.quarter === null).map((x) => [x.year, Number(x.target)]));
    const checkpoints = Object.fromEntries(t.filter((x) => x.year === year && x.quarter !== null).map((x) => [x.quarter, Number(x.target)]));
    const vals = (values || []).filter((v) => v.kpi_id === k.id);
    const manual = vals.filter((v) => v.source === "manual");
    const actual = k.source === "auto" ? auto[k.key] ?? 0 : manual.length ? Number(manual[0].value) : null;
    const target = yearly[year] ?? 0;
    const expected = expectedNow(k.unit as KpiUnit, target, year, now);
    return {
      ...(k as Omit<Kpi, "targets" | "checkpoints" | "actual" | "expected" | "onTrack" | "trend" | "history">),
      targets: yearly, checkpoints, actual, expected,
      // Before the year starts there is nothing to be behind on.
      onTrack: !started || actual === null ? !started : actual >= expected,
      trend: monthlyTrend(vals.map((v) => ({ value: Number(v.value), on_date: v.on_date })), k.source === "auto" ? actual : null, now),
      history: manual.slice(0, 24).map((v) => ({ value: Number(v.value), on_date: v.on_date, note: v.note, created_by: v.created_by })),
    };
  });
}

export async function getPlan(year = PLAN_YEAR) {
  const db = supabaseAdmin();
  const [{ data: py }, { data: ms }, { data: gates }, { data: crit }, kpis] = await Promise.all([
    db.from("plan_years").select("year,theme,why").eq("year", year).maybeSingle(),
    db.from("milestones").select("id,year,quarter,department,title,owner_id,status,project_ids,ticket_ids,sort,done_at").eq("year", year).order("sort").order("created_at"),
    db.from("gates").select("id,year,after_quarter,title,sort").order("sort"),
    db.from("gate_criteria").select("id,gate_id,text,met,sort").order("sort").order("created_at"),
    getKpis(year),
  ]);
  const milestones = (ms || []) as Milestone[];
  // "Mark done" is suggested when every linked ticket is done; a person confirms it.
  const ticketIds = [...new Set(milestones.flatMap((m) => m.ticket_ids))];
  if (ticketIds.length) {
    const { data: tickets } = await db.from("tickets").select("id,status").in("id", ticketIds);
    const done = new Set((tickets || []).filter((t) => t.status === "done").map((t) => t.id));
    for (const m of milestones) m.ticketsDone = m.ticket_ids.length > 0 && m.ticket_ids.every((id) => done.has(id));
  }
  return {
    year, why: ((py?.why ?? {}) as Why), theme: py?.theme ?? "", milestones, kpis,
    gates: (gates || []).map((g) => ({ ...g, criteria: (crit || []).filter((c) => c.gate_id === g.id) })) as Gate[],
  };
}

/** Everything the Home card needs. */
export async function getPlanSummary(year = PLAN_YEAR) {
  const db = supabaseAdmin();
  const { quarter, started } = planQuarter(year);
  const [{ data: ms }, { data: gates }, { data: crit }, kpis] = await Promise.all([
    db.from("milestones").select("status").eq("year", year).eq("quarter", quarter),
    db.from("gates").select("id,title,year,after_quarter,sort").order("sort"),
    db.from("gate_criteria").select("gate_id,met"),
    getKpis(year),
  ]);
  const gs = (gates || []).map((g) => ({ ...g, total: (crit || []).filter((c) => c.gate_id === g.id).length, met: (crit || []).filter((c) => c.gate_id === g.id && c.met).length }));
  return {
    year, quarter, started,
    milestones: { done: (ms || []).filter((m) => m.status === "done").length, total: (ms || []).length },
    kpis: ["revenue", "partners", "subscribers"].map((k) => kpis.find((x) => x.key === k)).filter(Boolean) as Kpi[],
    nextGate: gs.find((g) => g.total === 0 || g.met < g.total) ?? null,
  };
}

/** A review's frozen copy of the plan: every milestone status and KPI value at that moment. */
export async function planSnapshot(year = PLAN_YEAR) {
  const p = await getPlan(year);
  return {
    taken_at: new Date().toISOString(),
    milestones: p.milestones.map((m) => ({ title: m.title, department: m.department, quarter: m.quarter, status: m.status })),
    kpis: p.kpis.map((k) => ({ key: k.key, name_en: k.name_en, name_ar: k.name_ar, unit: k.unit, actual: k.actual, target: k.targets[year] ?? null, onTrack: k.onTrack })),
    gates: p.gates.map((g) => ({ title: g.title, met: g.criteria.filter((c) => c.met).length, total: g.criteria.length })),
  };
}
export type PlanSnapshot = Awaited<ReturnType<typeof planSnapshot>>;

export const fmtKpi = (unit: KpiUnit, v: number | null) =>
  v === null ? "–" : unit === "usd" ? `$${Math.round(v).toLocaleString("en")}` : unit === "percent" ? `${Math.round(v * 10) / 10}%` : Math.round(v).toLocaleString("en");
