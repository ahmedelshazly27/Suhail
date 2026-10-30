"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { addDays, todayISO } from "@/lib/dates";
import { drive } from "@/lib/m365/drive";
import { notifyPeople } from "@/lib/notify";
import { supabaseServer } from "@/lib/supabase/server";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60) || "project";

const schema = z.object({
  name: z.string().trim().min(2).max(120), template_key: z.string().max(40).nullish(), target_date: z.string().date().nullish(),
  lead_id: z.string().uuid().nullish(), budget: z.coerce.number().min(0).max(10_000_000).nullish(), sharepoint: z.boolean().default(true),
});

/** New project, optionally from a template: its tickets get relative due dates and owners by job function. */
export async function createProject(input: z.input<typeof schema>) {
  const me = await requireMe();
  const v = schema.parse(input);
  const db = await supabaseServer();
  let slug = slugify(v.name);
  if ((await db.from("projects").select("id").eq("slug", slug).maybeSingle()).data) slug += "-" + Date.now().toString(36).slice(-4);
  const { data: p, error } = await db.from("projects").insert({ slug, name: v.name, lead_id: v.lead_id || me.id, target_date: v.target_date || null, budget: v.budget ?? null, template_key: v.template_key || null, created_by: me.id }).select("id,slug").single();
  if (error) throw new Error(error.message);
  await logActivity(db, me.id, "project", p.id, "created", { template: v.template_key });

  if (v.template_key) {
    const { data: tpl } = await db.from("project_templates").select("items").eq("key", v.template_key).single();
    const { data: people } = await db.from("profiles").select("id,functions").eq("active", true);
    const owner = (role: string) => people?.find((x) => (x.functions as string[]).includes(role))?.id ?? v.lead_id ?? me.id;
    const target = v.target_date || addDays(todayISO(), 60);
    const items = (tpl?.items || []) as { title: string; offset_days: number; role: string; estimate: number; group: string }[];
    const { data: labels } = await db.from("labels").select("id,name");
    const rows = items.map((it, i) => ({
      title: it.title, project_id: p.id, status: "todo", due_on: addDays(target, it.offset_days), assignee_id: owner(it.role), estimate: it.estimate,
      labels: labels?.filter((l) => l.name.toLowerCase() === it.group.toLowerCase()).map((l) => l.id) ?? [], source: "template", source_ref: v.template_key, sort: i * 1000, created_by: me.id,
    }));
    if (rows.length) await db.from("tickets").insert(rows);
    const assigned = [...new Set(rows.map((r) => r.assignee_id))].filter((x) => x !== me.id);
    await notifyPeople(assigned, { kind: "assigned", title: `${me.name} created ${v.name} with tickets for you`, entity_type: "project", entity_id: p.id, href: `/team/projects/${p.slug}` });
  }

  // Each project gets its folder inside Projects/ on the shared drive.
  if (v.sharepoint) {
    try {
      const d = await drive(me.id);
      if (d.live) { const root = (await d.folders()).find((f) => f.name === "Projects"); if (root) { const f = await d.createFolder(root.id, v.name); await db.from("projects").update({ sharepoint_folder_url: f.webUrl }).eq("id", p.id); } }
    } catch (e) { console.error("sharepoint folder", e); }
  }
  revalidatePath("/team", "layout");
  redirect(`/team/projects/${p.slug}`);
}

const patch = z.object({ name: z.string().trim().min(2).max(120), lead_id: z.string().uuid().nullable(), status: z.enum(["planned", "active", "paused", "done"]), target_date: z.string().date().nullable(), budget: z.number().min(0).nullable(), doc: z.object({ type: z.literal("doc") }).passthrough(), description: z.object({ type: z.literal("doc") }).passthrough() }).partial();

export async function updateProject(id: string, input: z.input<typeof patch>) {
  const me = await requireMe();
  const v = patch.parse(input);
  const db = await supabaseServer();
  await db.from("projects").update(v).eq("id", z.string().uuid().parse(id));
  if (!("doc" in v)) await logActivity(db, me.id, "project", id, "changed", { fields: Object.keys(v) });
  revalidatePath("/team", "layout");
}
