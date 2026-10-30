"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { teams } from "@/lib/m365";
import { supabaseServer } from "@/lib/supabase/server";

/** The next sprint, right after the last one, with the configured length (two weeks by default). */
export async function createNextSprint() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ data: last }, { data: settings }] = await Promise.all([db.from("sprints").select("number,ends_on").order("number", { ascending: false }).limit(1).maybeSingle(), db.from("settings").select("data").single()]);
  const len = Number((settings?.data as { sprint_length_days?: number })?.sprint_length_days) || 14;
  const starts = last ? addDays(last.ends_on, 1) : todayISO();
  const { data } = await db.from("sprints").insert({ number: (last?.number ?? 0) + 1, starts_on: starts, ends_on: addDays(starts, len - 1), created_by: me.id }).select("id").single();
  revalidatePath("/team/sprints");
  return data?.id;
}

/** Ends the running sprint and starts this one. Posts a card to the Teams channel when it's set up. */
export async function startSprint(id: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data: s } = await db.from("sprints").select("number,starts_on,ends_on").eq("id", z.string().uuid().parse(id)).single();
  await db.from("sprints").update({ status: "done" }).eq("status", "active");
  await db.from("sprints").update({ status: "active" }).eq("id", id);
  await logActivity(db, me.id, "sprint", id, "started");
  if (s) await teams().channel({ title: `Sprint ${s.number} started`, text: `${s.starts_on} to ${s.ends_on}`, href: "/team/sprints" }).catch(() => {});
  revalidatePath("/team", "layout");
}

/** One click: every unfinished ticket of a sprint moves to another. */
export async function rollOver(fromId: string, toId: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data } = await db.from("tickets").update({ sprint_id: z.string().uuid().parse(toId) }).eq("sprint_id", z.string().uuid().parse(fromId)).not("status", "in", "(done,cancelled)").is("deleted_at", null).select("id");
  for (const t of data || []) await logActivity(db, me.id, "ticket", t.id, "changed", { field: "sprint_id", to: toId, rollover: true });
  revalidatePath("/team", "layout");
  return data?.length ?? 0;
}
