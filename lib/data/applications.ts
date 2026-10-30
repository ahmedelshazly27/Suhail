import "server-only";
import { careersFields, STATIC_FORMS, flat, type Field } from "@/lib/forms";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type AppRow = { id: string; form_key: string; role_id: string | null; stage: string; assignee_id: string | null; score: number | null; email: string; name: string; lang: string; tags: string[]; created_at: string; answers: Record<string, unknown>; cv_path: string | null; cv_url: string | null };
export type FormRow = { key: string; name_en: string; name_ar: string; stages: string[]; count: number };
export type RoleRow = { id: string; slug: string; title_en: string; title_ar: string; plain_en: string; plain_ar: string; status: string; rubric: { key: string; en: string }[]; form_schema: unknown; count: number };

export async function getApplicationsHome(form: string) {
  const db = await supabaseServer();
  const [forms, roles, apps, all] = await Promise.all([
    db.from("forms").select("key,name_en,name_ar,stages").order("key"),
    db.from("roles").select("id,slug,title_en,title_ar,plain_en,plain_ar,status,rubric,form_schema").order("sort"),
    db.from("applications").select("id,form_key,role_id,stage,assignee_id,score,email,name,lang,tags,created_at,answers,cv_path,cv_url").eq("form_key", form).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
    db.from("applications").select("form_key,role_id,email").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>(); const roleCounts = new Map<string, number>(); const emails = new Map<string, number>();
  for (const a of all.data || []) { counts.set(a.form_key, (counts.get(a.form_key) || 0) + 1); if (a.role_id) roleCounts.set(a.role_id, (roleCounts.get(a.role_id) || 0) + 1); emails.set(a.email, (emails.get(a.email) || 0) + 1); }
  return {
    forms: ((forms.data || []) as Omit<FormRow, "count">[]).map((f) => ({ ...f, count: counts.get(f.key) || 0 })),
    roles: ((roles.data || []) as Omit<RoleRow, "count">[]).map((r) => ({ ...r, count: roleCounts.get(r.id) || 0 })),
    apps: ((apps.data || []) as AppRow[]).map((a) => ({ ...a, duplicate: (emails.get(a.email) || 0) > 1 })),
  };
}

/** Fields in display order, with the role's own task marked so it can be highlighted. */
export function answerFields(form: string, roleSchema: unknown): (Field & { task?: boolean })[] {
  if (form !== "careers") return flat(STATIC_FORMS[form]?.fields || []);
  const task = new Set(flat((roleSchema as never) || []).map((f) => f.id));
  return flat(careersFields(roleSchema)).map((f) => ({ ...f, task: task.has(f.id) }));
}

export async function getApplication(id: string, meId: string) {
  const db = await supabaseServer();
  const { data: a } = await db.from("applications").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!a) return null;
  const [role, notes, acts, scores, emails, dupes, form] = await Promise.all([
    a.role_id ? db.from("roles").select("id,slug,title_en,title_ar,plain_en,plain_ar,rubric,form_schema").eq("id", a.role_id).single() : Promise.resolve({ data: null }),
    db.from("application_notes").select("id,body,created_by,created_at").eq("application_id", id),
    db.from("activity").select("id,actor_id,verb,data,created_at").eq("entity_type", "application").eq("entity_id", id),
    db.from("rubric_scores").select("profile_id,criterion,score").eq("application_id", id),
    db.from("email_log").select("id,subject,template,status,created_at").eq("entity_type", "application").eq("entity_id", id).order("created_at"),
    db.from("applications").select("id,form_key,stage,created_at").eq("email", a.email).neq("id", id).is("deleted_at", null),
    db.from("forms").select("key,name_en,name_ar,stages").eq("key", a.form_key).single(),
  ]);
  // CVs: private bucket, a 60-second signed URL minted only for teammates (RLS read above already checked is_team()).
  let cvSigned: string | null = null;
  if (a.cv_path) { const s = await supabaseAdmin().storage.from("cvs").createSignedUrl(a.cv_path, 60).catch(() => ({ data: null })); cvSigned = s.data?.signedUrl ?? null; }
  const feed = [
    ...(notes.data || []).map((n) => ({ kind: "comment" as const, id: n.id, at: n.created_at, actor: n.created_by, body: n.body })),
    ...(acts.data || []).map((x) => ({ kind: "event" as const, id: String(x.id), at: x.created_at, actor: x.actor_id, verb: x.verb, data: x.data })),
  ].sort((x, y) => x.at.localeCompare(y.at));
  return {
    app: a as AppRow & { hackathon_id: string | null; stage_changed_at: string }, role: role.data as RoleRow | null, form: form.data as Omit<FormRow, "count">,
    fields: answerFields(a.form_key, role.data?.form_schema), feed, emails: emails.data || [], dupes: dupes.data || [], cvSigned,
    myScores: Object.fromEntries((scores.data || []).filter((s) => s.profile_id === meId).map((s) => [s.criterion, s.score])) as Record<string, number>,
    avgScores: Object.fromEntries([...new Set((scores.data || []).map((s) => s.criterion))].map((c) => { const v = (scores.data || []).filter((s) => s.criterion === c); return [c, v.reduce((n, s) => n + s.score, 0) / v.length]; })) as Record<string, number>,
  };
}
