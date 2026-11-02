"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, requireMe, type Me } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyPeople } from "@/lib/notify";
import { MILESTONE_STATUSES, PLAN_YEAR, planSnapshot } from "@/lib/plan";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// Plan edits go through RLS as the signed-in teammate: owners and admins edit the plan, a milestone's owner keeps
// it current, a manual KPI's owner records its values, Finance records income.

const refresh = () => { revalidatePath("/team/plan"); revalidatePath("/team"); };
const admin = (me: Me) => { if (!isAdmin(me)) throw new Error("Only owners and admins can change the plan."); };
const doc = z.object({ type: z.literal("doc") }).passthrough();

export async function saveWhy(part: "mission" | "vision" | "principles", value: unknown, year = PLAN_YEAR) {
  const me = await requireMe(); admin(me);
  const v = doc.parse(value);
  const db = await supabaseServer();
  const { data } = await db.from("plan_years").select("why").eq("year", year).single();
  const { error } = await db.from("plan_years").update({ why: { ...((data?.why as object) || {}), [z.enum(["mission", "vision", "principles"]).parse(part)]: v }, updated_by: me.id }).eq("year", year);
  if (error) throw new Error(error.message);
  revalidatePath("/team/plan");
}

const milestone = z.object({
  id: z.string().uuid().optional(), year: z.number().int().default(PLAN_YEAR), quarter: z.number().int().min(1).max(4),
  department: z.string().trim().min(1).max(60), title: z.string().trim().min(1).max(200), owner_id: z.string().uuid().nullish(),
  status: z.enum(MILESTONE_STATUSES), project_ids: z.array(z.string().uuid()).max(20).default([]), ticket_ids: z.array(z.string().uuid()).max(50).default([]),
});

/** Create or update a milestone. Owners and admins change anything; a milestone's owner can update their own. */
export async function saveMilestone(input: z.input<typeof milestone>) {
  const me = await requireMe();
  const v = milestone.parse(input);
  const db = await supabaseServer();
  const before = v.id ? (await db.from("milestones").select("status,owner_id,title").eq("id", v.id).single()).data : null;
  if (!v.id || !before || before.owner_id !== me.id) admin(me);
  const row = { ...v, owner_id: v.owner_id || null, done_at: v.status === "done" ? new Date().toISOString() : null };
  const { data, error } = v.id
    ? await db.from("milestones").update(row).eq("id", v.id).select("id").single()
    : await db.from("milestones").insert({ ...row, created_by: me.id }).select("id").single();
  if (error) throw new Error(error.message);
  if (before?.status !== v.status) await logActivity(db, me.id, "milestone", data.id, "changed", { field: "status", from: before?.status ?? null, to: v.status });
  // At risk: its owner and the founder hear about it, once, when it turns.
  if (v.status === "at_risk" && before?.status !== "at_risk") {
    const { data: owners } = await supabaseAdmin().from("profiles").select("id").eq("active", true).eq("team_role", "owner");
    await notifyPeople([v.owner_id ?? "", ...(owners || []).map((o) => o.id)].filter((id) => id && id !== me.id), {
      kind: "milestone", title: `At risk: ${v.title}`, body: `Q${v.quarter} ${v.year} · ${v.department}`, href: "/team/plan?tab=roadmap",
    });
  }
  refresh();
}

export async function deleteMilestone(id: string) {
  const me = await requireMe(); admin(me);
  const db = await supabaseServer();
  const { error } = await db.from("milestones").delete().eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  refresh();
}

export async function setCriterion(id: string, met: boolean) {
  const me = await requireMe(); admin(me);
  const db = await supabaseServer();
  const { error } = await db.from("gate_criteria").update({ met, met_at: met ? new Date().toISOString() : null, met_by: met ? me.id : null }).eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  refresh();
}

export async function addCriterion(gateId: string, text: string) {
  const me = await requireMe(); admin(me);
  const db = await supabaseServer();
  const { error } = await db.from("gate_criteria").insert({ gate_id: z.string().uuid().parse(gateId), text: z.string().trim().min(1).max(200).parse(text), sort: Date.now() % 1e6 });
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteCriterion(id: string) {
  const me = await requireMe(); admin(me);
  const db = await supabaseServer();
  const { error } = await db.from("gate_criteria").delete().eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  refresh();
}

const kpiSettings = z.object({
  id: z.string().uuid(), owner_id: z.string().uuid().nullish(),
  targets: z.record(z.string().regex(/^\d{4}$/), z.number().min(0).max(1e10).nullable()),
  checkpoints: z.record(z.string().regex(/^[1-4]$/), z.number().min(0).max(1e10).nullable()),
});

/** Owner and targets of a KPI. Empty targets are removed. */
export async function saveKpiSettings(input: z.input<typeof kpiSettings>, year = PLAN_YEAR) {
  const me = await requireMe(); admin(me);
  const v = kpiSettings.parse(input);
  const db = await supabaseServer();
  await db.from("kpis").update({ owner_id: v.owner_id || null }).eq("id", v.id);
  const rows = [
    ...Object.entries(v.targets).map(([y, t]) => ({ year: Number(y), quarter: null as number | null, t })),
    ...Object.entries(v.checkpoints).map(([q, t]) => ({ year, quarter: Number(q), t })),
  ];
  for (const r of rows) {
    const match = db.from("kpi_targets").delete().eq("kpi_id", v.id).eq("year", r.year);
    await (r.quarter === null ? match.is("quarter", null) : match.eq("quarter", r.quarter));
    if (r.t !== null) {
      const { error } = await db.from("kpi_targets").insert({ kpi_id: v.id, year: r.year, quarter: r.quarter, target: r.t });
      if (error) throw new Error(error.message);
    }
  }
  refresh();
}

const value = z.object({ kpi_id: z.string().uuid(), value: z.coerce.number().min(0).max(1e10), on_date: z.string().date(), note: z.string().trim().max(500).default("") });

/** A manual KPI value, by its owner (or an admin). Values are history: a correction is a new entry. */
export async function addKpiValue(input: z.input<typeof value>) {
  const me = await requireMe();
  const v = value.parse(input);
  const db = await supabaseServer();
  const { error } = await db.from("kpi_values").insert({ ...v, source: "manual", created_by: me.id });
  if (error) throw new Error(error.message.includes("row-level security") ? "Only this KPI's owner can enter its values." : error.message);
  refresh();
}

const review = z.object({ quarter: z.number().int().min(1).max(4), went_well: z.string().trim().max(4000), went_badly: z.string().trim().max(4000), will_change: z.string().trim().max(4000) });

/** End-of-quarter review: a frozen snapshot of the plan plus three notes. Read-only once saved. */
export async function createReview(input: z.input<typeof review>, year = PLAN_YEAR) {
  const me = await requireMe(); admin(me);
  const v = review.parse(input);
  const db = await supabaseServer();
  const { error } = await db.from("plan_reviews").insert({ year, ...v, snapshot: await planSnapshot(year), created_by: me.id });
  if (error) throw new Error(error.code === "23505" ? `Q${v.quarter} ${year} already has a review.` : error.message);
  refresh();
}

const income = z.object({ received_on: z.string().date(), partner: z.string().trim().min(1).max(160), amount_usd: z.coerce.number().positive().max(1e9), relationship_id: z.string().uuid().nullish(), note: z.string().trim().max(500).default("") });

/** Income recorded by Finance. Revenue on the plan is the sum of these. */
export async function addIncome(input: z.input<typeof income>) {
  const me = await requireMe();
  const v = income.parse(input);
  const db = await supabaseServer();
  const { error } = await db.from("income").insert({ ...v, relationship_id: v.relationship_id || null, created_by: me.id });
  if (error) throw new Error(error.message.includes("row-level security") ? "Only Finance can record income." : error.message);
  revalidatePath("/team/finance"); refresh();
}

