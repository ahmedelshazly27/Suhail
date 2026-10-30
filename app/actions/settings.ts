"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { supabaseServer } from "@/lib/supabase/server";

const done = () => revalidatePath("/team", "layout");

export async function saveMe(input: { digest_email?: boolean; standup_enabled?: boolean; capacity?: number; lang?: "ar" | "en" }) {
  const me = await requireMe();
  const v = z.object({ digest_email: z.boolean(), standup_enabled: z.boolean(), capacity: z.number().int().min(0).max(60), lang: z.enum(["ar", "en"]) }).partial().parse(input);
  await (await supabaseServer()).from("profiles").update(v).eq("id", me.id);
  done();
}

export async function regenerateIcs() {
  const me = await requireMe();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
  await (await supabaseServer()).from("profiles").update({ ics_token: token }).eq("id", me.id);
  done();
}

/** Functions decide approvals and Drive access (finance). Access itself follows the Microsoft 365 groups. */
export async function saveMember(id: string, input: { functions?: string[]; active?: boolean; capacity?: number }) {
  const me = await requireAdmin();
  const v = z.object({ functions: z.array(z.enum(["finance", "partnerships", "events", "editorial", "engineering"])).max(5), active: z.boolean(), capacity: z.number().int().min(0).max(60) }).partial().parse(input);
  const db = await supabaseServer();
  const { error } = await db.from("profiles").update(v).eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  await logActivity(db, me.id, "profile", id, "changed", v);
  done();
}

export async function saveStages(key: string, stages: string[]) {
  await requireAdmin();
  const v = z.array(z.string().trim().min(1).max(30)).min(2).max(12).parse(stages);
  await (await supabaseServer()).from("forms").update({ stages: v }).eq("key", z.string().max(30).parse(key));
  done();
}

const field = z.object({ id: z.string().regex(/^[a-z0-9_]{1,40}$/), en: z.string().max(400), ar: z.string().max(400), type: z.enum(["text", "email", "select", "radio", "checks", "textarea", "file", "head"]), req: z.union([z.number(), z.boolean()]).optional(), opts: z.union([z.literal("@countries"), z.array(z.tuple([z.string(), z.string(), z.string()]))]).optional(), ltr: z.union([z.number(), z.boolean()]).optional(), ph: z.string().max(120).optional(), max: z.number().int().min(1).max(2000).optional(), note: z.tuple([z.string(), z.string()]).optional() });
const roleSchema = z.object({
  title_en: z.string().min(1).max(120), title_ar: z.string().min(1).max(120), plain_en: z.string().min(1).max(120), plain_ar: z.string().min(1).max(120),
  pitch_en: z.string().max(600), pitch_ar: z.string().max(600), do_en: z.array(z.string().max(400)).max(8), do_ar: z.array(z.string().max(400)).max(8),
  you_en: z.array(z.string().max(400)).max(8), you_ar: z.array(z.string().max(400)).max(8), form_schema: z.array(field).max(30), rubric: z.array(z.object({ key: z.string().regex(/^[a-z0-9_]{1,30}$/), en: z.string().max(120) })).max(8),
  status: z.enum(["open", "closed"]), sort: z.number().int(),
}).partial();

/** Roles live in the database, so they can be opened, closed, copied and given new questions without a deploy. */
export async function saveRole(id: string | null, input: z.input<typeof roleSchema> & { slug?: string }) {
  const me = await requireAdmin();
  const v = roleSchema.parse(input);
  const db = await supabaseServer();
  if (id) { const { error } = await db.from("roles").update(v).eq("id", z.string().uuid().parse(id)); if (error) throw new Error(error.message); }
  else { const slug = z.string().regex(/^[a-z0-9-]{2,40}$/).parse(input.slug); const { error } = await db.from("roles").insert({ ...v, slug, created_by: me.id }); if (error) throw new Error(error.message); }
  revalidateTag("roles", "max");
  done();
}

export async function copyRole(id: string) {
  const me = await requireAdmin();
  const db = await supabaseServer();
  const { data: r } = await db.from("roles").select("*").eq("id", z.string().uuid().parse(id)).single();
  if (!r) throw new Error("not found");
  const { id: _i, created_at: _c, updated_at: _u, ...rest } = r; void _i; void _c; void _u;
  await db.from("roles").insert({ ...rest, slug: `${r.slug}-copy-${Date.now().toString(36).slice(-3)}`, title_en: `${r.title_en} (copy)`, status: "closed", created_by: me.id });
  done();
}

export async function saveTemplate(key: string, input: { subject_en: string; subject_ar: string; body_en: string; body_ar: string; name?: string }) {
  const me = await requireAdmin();
  const v = z.object({ subject_en: z.string().min(1).max(200), subject_ar: z.string().min(1).max(200), body_en: z.string().min(1).max(5000), body_ar: z.string().min(1).max(5000), name: z.string().max(80).optional() }).parse(input);
  const db = await supabaseServer();
  await db.from("email_templates").upsert({ key: z.string().regex(/^[a-z_]{2,30}$/).parse(key), name: v.name ?? key, ...v, updated_by: me.id });
  done();
}

export async function saveLabel(id: string | null, name: string, attention = false, remove = false) {
  await requireAdmin();
  const db = await supabaseServer();
  if (remove && id) await db.from("labels").delete().eq("id", z.string().uuid().parse(id));
  else if (id) await db.from("labels").update({ name: z.string().trim().min(1).max(40).parse(name), attention }).eq("id", id);
  else await db.from("labels").insert({ name: z.string().trim().min(1).max(40).parse(name), attention });
  done();
}

export async function saveProjectTemplate(key: string, name: string, itemsJson: string) {
  await requireAdmin();
  const items = z.array(z.object({ group: z.string().max(40), title: z.string().min(1).max(200), offset_days: z.number().int().min(-365).max(365), role: z.string().max(30), estimate: z.number().int().min(0).max(40) })).max(80).parse(JSON.parse(itemsJson));
  await (await supabaseServer()).from("project_templates").upsert({ key: z.string().regex(/^[a-z0-9_-]{2,30}$/).parse(key), name: z.string().min(1).max(80).parse(name), items });
  done();
}

export async function saveCategory(key: string, name: string, remove = false) {
  await requireAdmin();
  const db = await supabaseServer();
  if (remove) await db.from("expense_categories").delete().eq("key", key);
  else await db.from("expense_categories").upsert({ key: z.string().regex(/^[a-z0-9_]{2,30}$/).parse(key), name: z.string().min(1).max(60).parse(name) });
  done();
}

const settingsSchema = z.object({
  sprint_length_days: z.number().int().min(5).max(42), retention_not_now_months: z.number().int().min(1).max(60), operations_budget: z.number().min(0).max(10_000_000),
  standup: z.object({ enabled: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)).max(7), tz: z.string().max(60) }),
  m365: z.record(z.string(), z.boolean()), teams: z.object({ channel_webhook: z.boolean(), bot: z.boolean() }),
}).partial();

export async function saveSettings(input: z.input<typeof settingsSchema>) {
  const me = await requireAdmin();
  const v = settingsSchema.parse(input);
  const db = await supabaseServer();
  const { data } = await db.from("settings").select("data").single();
  await db.from("settings").update({ data: { ...(data?.data as object), ...v }, updated_by: me.id }).eq("id", true);
  done();
}

export async function setTeamPrefAction(name: "team-lang" | "team-theme", value: string) {
  const { setTeamPref } = await import("./auth");
  await setTeamPref(name, value);
  done();
}
