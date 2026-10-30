import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import type { Me } from "@/lib/auth";

export type TicketRow = { id: string; key: string; title: string; status: string; priority: string; due_on: string | null; estimate: number | null; flagged: boolean; project: { name: string; slug: string } | null; assignee_id: string | null };

export async function getHome(me: Me) {
  const db = await supabaseServer();
  const today = todayISO(), week = addDays(today, 7);
  const [mine, sprint, mentions, standup, standupCount, expenses, contentWeek] = await Promise.all([
    db.from("tickets").select("id,key,title,status,priority,due_on,estimate,flagged,assignee_id,project:projects(name,slug)").eq("assignee_id", me.id).is("deleted_at", null).not("status", "in", "(done,cancelled)").order("due_on", { ascending: true, nullsFirst: false }).limit(30),
    db.from("sprints").select("id,number,starts_on,ends_on").eq("status", "active").maybeSingle(),
    db.from("notifications").select("id,kind,title,body,href,created_at,read_at").eq("profile_id", me.id).eq("kind", "mention").order("created_at", { ascending: false }).limit(3),
    db.from("standups").select("day,done,next,blockers").eq("profile_id", me.id).lte("day", today).order("day", { ascending: false }).limit(1).maybeSingle(),
    db.from("standups").select("id", { count: "exact", head: true }).eq("day", today),
    me.functions.includes("finance") || me.team_role !== "member" ? db.from("expenses").select("id,description,amount,currency,project:projects(name)").eq("status", "pending").order("created_at").limit(3) : Promise.resolve({ data: [] }),
    db.from("content_items").select("id,title,channel,publish_on,status").gte("publish_on", today).lte("publish_on", week).order("publish_on").limit(6),
  ]);
  let sprintStats = null as null | { number: number; done: number; total: number; day: number; days: number; blocked: number; overdue: number; next: number };
  if (sprint.data) {
    const { data: st } = await db.from("tickets").select("status,estimate,flagged,due_on").eq("sprint_id", sprint.data.id).is("deleted_at", null);
    const pts = (s?: string) => (st || []).filter((t) => !s || t.status === s).reduce((n, t) => n + (t.estimate || 0), 0);
    const days = Math.max(1, Math.round((Date.parse(sprint.data.ends_on) - Date.parse(sprint.data.starts_on)) / 864e5) + 1);
    sprintStats = {
      number: sprint.data.number, done: pts("done"), total: pts(), days: Math.round(days * 5 / 7),
      day: Math.min(Math.round(days * 5 / 7), Math.max(1, Math.round((Math.round((Date.parse(today) - Date.parse(sprint.data.starts_on)) / 864e5) + 1) * 5 / 7))),
      blocked: (st || []).filter((t) => t.flagged && t.status !== "done").length,
      overdue: (st || []).filter((t) => t.due_on && t.due_on < today && t.status !== "done").length,
      next: sprint.data.number + 1,
    };
  }
  const tickets = (mine.data || []) as unknown as TicketRow[];
  return {
    tickets, dueWeek: tickets.filter((t) => t.due_on && t.due_on <= week),
    sprint: sprintStats, mentions: mentions.data || [],
    // today's answers, or yesterday's "next" as today's "done"
    standup: standup.data ? (standup.data.day === today ? standup.data : { done: standup.data.next, next: "", blockers: "" }) : null, standupCount: standupCount.count ?? 0,
    expenses: (expenses.data || []) as unknown as { id: string; description: string; amount: number; currency: string; project: { name: string } | null }[],
    week: [
      ...(contentWeek.data || []).map((c) => ({ day: c.publish_on as string, title: c.title, meta: c.channel })),
      ...tickets.filter((t) => t.due_on && t.due_on >= today && t.due_on <= week).map((t) => ({ day: t.due_on as string, title: t.title, meta: t.key })),
      ...(sprint.data && sprint.data.ends_on <= week ? [{ day: sprint.data.ends_on, title: `Sprint ${sprint.data.number} review`, meta: "Sprint" }] : []),
    ].sort((a, b) => a.day.localeCompare(b.day)).slice(0, 5),
  };
}
