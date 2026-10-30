"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { createTicket } from "./tickets";
import { supabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

const schema = z.object({ done: z.string().trim().max(1000), next: z.string().trim().max(1000), blockers: z.string().trim().max(1000) });

/** Today's stand-up. A blocker becomes a flagged ticket for the lead of the person's busiest project. */
export async function postStandup(_: unknown, form: FormData) {
  const me = await requireMe();
  const v = schema.parse({ done: form.get("done") ?? "", next: form.get("next") ?? "", blockers: form.get("blockers") ?? "" });
  const db = await supabaseServer();
  const today = todayISO();
  const { data: sprint } = await db.from("sprints").select("id").eq("status", "active").maybeSingle();
  const { data: prev } = await db.from("standups").select("blocker_ticket_id,blockers").eq("profile_id", me.id).eq("day", today).maybeSingle();
  let blocker_ticket_id = prev?.blocker_ticket_id ?? null;
  if (v.blockers && v.blockers !== prev?.blockers) {
    const { data: t } = await db.from("tickets").select("project_id,project:projects(lead_id)").eq("assignee_id", me.id).is("deleted_at", null).not("project_id", "is", null).limit(1).maybeSingle();
    const lead = (t?.project as unknown as { lead_id: string | null } | null)?.lead_id ?? null;
    const created = await createTicket({ title: `Blocked: ${v.blockers.slice(0, 120)} (${me.name})`, project_id: t?.project_id ?? null, assignee_id: lead, status: "todo", priority: "high" });
    await db.from("tickets").update({ flagged: true, source: "standup" }).eq("id", created.id);
    blocker_ticket_id = created.id;
  }
  await db.from("standups").upsert({ profile_id: me.id, day: today, sprint_id: sprint?.id ?? null, ...v, blocker_ticket_id, via: "app" }, { onConflict: "profile_id,day" });
  revalidatePath("/team");
  return { ok: true };
}
