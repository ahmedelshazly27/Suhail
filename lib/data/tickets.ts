import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type Ticket = {
  id: string; number: number; key: string; title: string; description: unknown; status: string; priority: string;
  assignee_id: string | null; project_id: string | null; sprint_id: string | null; parent_id: string | null;
  due_on: string | null; estimate: number | null; labels: string[]; flagged: boolean; sort: number; source: string; created_at: string; created_by: string | null;
};
export type Label = { id: string; name: string; attention: boolean };
export type Project = { id: string; slug: string; name: string; lead_id: string | null; status: string; target_date: string | null; budget: number | null; currency: string; description: unknown; doc: unknown; sharepoint_folder_url: string | null; template_key: string | null };
export type Sprint = { id: string; number: number; starts_on: string; ends_on: string; status: string; capacity: Record<string, number> };
export type FeedItem = { kind: "comment" | "event"; id: string; at: string; actor: string | null; body?: unknown; verb?: string; data?: Record<string, unknown> };

const COLS = "id,number,key,title,description,status,priority,assignee_id,project_id,sprint_id,parent_id,due_on,estimate,labels,flagged,sort,source,created_at,created_by";

export async function getLabels(): Promise<Label[]> {
  const db = await supabaseServer();
  return ((await db.from("labels").select("id,name,attention").order("name")).data || []) as Label[];
}
export async function getSprints(): Promise<Sprint[]> {
  const db = await supabaseServer();
  return ((await db.from("sprints").select("id,number,starts_on,ends_on,status,capacity").order("number")).data || []) as Sprint[];
}

export async function getProject(slug: string) {
  const db = await supabaseServer();
  const { data: project } = await db.from("projects").select("*").eq("slug", slug).maybeSingle();
  if (!project) return null;
  const [tickets, spent] = await Promise.all([
    db.from("tickets").select(COLS).eq("project_id", project.id).is("deleted_at", null).order("sort").order("number"),
    db.from("expenses").select("amount").eq("project_id", project.id).in("status", ["approved", "paid", "pending"]),
  ]);
  return { project: project as Project, tickets: (tickets.data || []) as Ticket[], spent: (spent.data || []).reduce((n, e) => n + Number(e.amount), 0) };
}

export async function listTickets(f: { assignee?: string; sprint?: string | "none"; status?: string[]; project?: string } = {}) {
  const db = await supabaseServer();
  let q = db.from("tickets").select(COLS).is("deleted_at", null);
  if (f.assignee) q = q.eq("assignee_id", f.assignee);
  if (f.sprint === "none") q = q.is("sprint_id", null); else if (f.sprint) q = q.eq("sprint_id", f.sprint);
  if (f.status) q = q.in("status", f.status);
  if (f.project) q = q.eq("project_id", f.project);
  return ((await q.order("sort").order("number").limit(500)).data || []) as Ticket[];
}

/** One ticket with its sub-tickets, comments and activity merged into one feed. */
export async function getTicket(key: string) {
  const db = await supabaseServer();
  const num = Number(/^SUH-(\d+)$/i.exec(key)?.[1]);
  if (!num) return null;
  const { data: t } = await db.from("tickets").select(COLS).eq("number", num).is("deleted_at", null).maybeSingle();
  if (!t) return null;
  const [subs, comments, acts, files, mails, parent, project] = await Promise.all([
    db.from("tickets").select("id,key,title,status").eq("parent_id", t.id).is("deleted_at", null).order("number"),
    db.from("comments").select("id,body,created_by,created_at").eq("entity_type", "ticket").eq("entity_id", t.id),
    db.from("activity").select("id,actor_id,verb,data,created_at").eq("entity_type", "ticket").eq("entity_id", t.id),
    db.from("file_links").select("id,name,web_url,kind,created_by").eq("entity_type", "ticket").eq("entity_id", t.id),
    db.from("mail_links").select("id,subject,mailbox,web_link,from_email").eq("entity_type", "ticket").eq("entity_id", t.id),
    t.parent_id ? db.from("tickets").select("key,title").eq("id", t.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    t.project_id ? db.from("projects").select("name,slug").eq("id", t.project_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const feed: FeedItem[] = [
    ...(comments.data || []).map((c) => ({ kind: "comment" as const, id: c.id, at: c.created_at, actor: c.created_by, body: c.body })),
    ...(acts.data || []).map((a) => ({ kind: "event" as const, id: String(a.id), at: a.created_at, actor: a.actor_id, verb: a.verb, data: a.data })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return { ticket: t as Ticket, subs: subs.data || [], feed, files: files.data || [], mails: mails.data || [], parent: parent.data, project: project.data as { name: string; slug: string } | null };
}
