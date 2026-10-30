"use server";
// Public form endpoints. The anon key can't touch any table, so these validate, rate limit and check Turnstile,
// then write with the service role.
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { z } from "zod";
import { env } from "@/lib/env";
import { careersFields, checkAnswers, STATIC_FORMS, PUBLIC_FORM_KEYS, type Answers, type Opt, type Problem } from "@/lib/forms";

// zod for the envelope; field-level rules come from the form schema via checkAnswers. Kept here so zod stays off the client.
const answersSchema = z.record(z.string().max(64), z.union([z.string().max(8000), z.array(z.string().max(200)).max(40)])).refine((a) => Object.keys(a).length <= 60);
import { rateLimit, verifyTurnstile } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { notifyTeam } from "@/lib/notify";
import { Templated } from "@/emails/Templated";
import { NewsletterConfirm, CONFIRM_COPY } from "@/emails/NewsletterConfirm";
import { syncSubscriber } from "@/lib/newsletter";

export type Result = { ok: true; email?: string } | { ok: false; problem: Problem | "rate" | "bot" | "err" | "cv_noup" };

const lang = z.enum(["ar", "en"]);
const submitSchema = z.object({
  form: z.string().regex(/^(careers:[a-z0-9-]+|[a-z]+)$/),
  lang,
  answers: answersSchema,
  cvPath: z.string().regex(/^incoming\/[0-9a-f-]{36}\.pdf$/).nullable(),
  token: z.string().max(4096).nullable(),
});

async function hackathonOpts(): Promise<Opt[]> {
  const { data } = await supabaseAdmin().from("hackathons").select("id,slug,title_en,title_ar,city_en,city_ar").eq("published", true);
  return (data || []).map((e) => [e.slug, `${e.title_en} · ${e.city_en}`, `${e.title_ar} · ${e.city_ar}`]);
}

/** A signed URL the browser uploads the CV to directly (Vercel functions can't take a 10 MB body). */
// No Turnstile here: tokens are single-use and the submit that follows verifies it. The URL only allows one PDF
// up to 10 MB at a random path; uploads never referenced by an application are removed by the daily cleanup.
export async function cvUploadUrl(): Promise<{ ok: true; path: string; token: string } | { ok: false; problem: "rate" | "cv_noup" }> {
  if (!(await rateLimit("cv-upload", 6, 600))) return { ok: false, problem: "rate" };
  const path = `incoming/${randomUUID()}.pdf`;
  const { data, error } = await supabaseAdmin().storage.from("cvs").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, problem: "cv_noup" };
  return { ok: true, path, token: data.token };
}

export async function submitForm(raw: unknown): Promise<Result> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: "required" };
  const { form, lang, answers, cvPath, token } = parsed.data;
  if (!(await rateLimit("form", 5, 600))) return { ok: false, problem: "rate" };
  if (!(await verifyTurnstile(token))) return { ok: false, problem: "bot" };

  const db = supabaseAdmin();
  let formKey: string, roleId: string | null = null, roleName = "", rows;
  if (form.startsWith("careers:")) {
    const { data: role } = await db.from("roles").select("id,slug,plain_en,plain_ar,form_schema").eq("slug", form.slice(8)).eq("status", "open").maybeSingle();
    if (!role) return { ok: false, problem: "err" };
    formKey = "careers"; roleId = role.id; roleName = lang === "ar" ? role.plain_ar : role.plain_en; rows = careersFields(role.form_schema);
  } else {
    if (!(PUBLIC_FORM_KEYS as readonly string[]).includes(form)) return { ok: false, problem: "err" };
    formKey = form; rows = STATIC_FORMS[form].fields;
  }

  const hackathons = formKey === "hack" ? await hackathonOpts() : [];
  const problem = checkAnswers(rows, answers as Answers, { hackathons });
  if (problem) return { ok: false, problem };
  if (formKey === "careers" && !cvPath && !answers.cv_link) return { ok: false, problem: "cv_need" };
  if (cvPath) {
    const { data: files } = await db.storage.from("cvs").list("incoming", { search: cvPath.slice(9) });
    if (!files?.length) return { ok: false, problem: "cv_bad" };
  }

  const email = String(answers.email || "").toLowerCase();
  const name = String(answers.name || answers.company || "").slice(0, 120);
  // Only letters go into the email we send from our domain, so the form can't be used to mail links to strangers.
  const firstName = (name.split(/\s+/)[0] || "").replace(/[^\p{L}\p{M}'-]/gu, "").slice(0, 40);
  const hack = formKey === "hack" ? await db.from("hackathons").select("id").eq("slug", String(answers.event)).maybeSingle() : null;
  const { data: app, error } = await db.from("applications").insert({
    form_key: formKey, role_id: roleId, hackathon_id: hack?.data?.id ?? null, answers, email, name, lang,
    cv_path: cvPath, cv_url: (answers.cv_link as string) || null,
  }).select("id").single();
  if (error || !app) { console.error("submit", error?.message); return { ok: false, problem: "err" }; }

  await db.from("activity").insert({ entity_type: "application", entity_id: app.id, verb: "submitted", data: { form: formKey, role: roleName || null, lang } });

  // Confirmation to the applicant, in both languages, using the team-editable "received" template.
  if (email) {
    const { data: tpl } = await db.from("email_templates").select("*").eq("key", "received").single();
    const { data: formRow } = await db.from("forms").select("name_en,name_ar").eq("key", formKey).single();
    const what = roleName || (lang === "ar" ? formRow?.name_ar : formRow?.name_en) || "";
    if (tpl) {
      await sendEmail({
        to: email, subject: lang === "ar" ? `${tpl.subject_ar} · ${tpl.subject_en}` : `${tpl.subject_en} · ${tpl.subject_ar}`,
        react: createElement(Templated, { lang, bodyAr: tpl.body_ar, bodyEn: tpl.body_en, vars: { name: firstName, role: what }, bilingual: true }),
        log: { template: "received", entity_type: "application", entity_id: app.id },
      });
    }
  }

  await notifyTeam({
    kind: "application", title: `New application: ${name || email}`, body: roleName ? `Careers · ${roleName}` : formKey,
    entity_type: "application", entity_id: app.id, href: `/team/applications/${app.id}`,
  });
  return { ok: true, email };
}

const subSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), source: z.string().regex(/^[a-z-]{2,24}$/), lang, token: z.string().max(4096).nullable() });

/** Quick subscribe boxes: create or update a pending subscriber and send the double opt-in email. */
export async function subscribe(raw: unknown): Promise<Result> {
  const p = subSchema.safeParse(raw);
  if (!p.success) return { ok: false, problem: "bad_email" };
  const { email, source, lang, token } = p.data;
  if (!(await rateLimit("subscribe", 5, 600))) return { ok: false, problem: "rate" };
  if (!(await verifyTurnstile(token))) return { ok: false, problem: "bot" };
  const db = supabaseAdmin();
  const { data: cur } = await db.from("subscribers").select("id,status,sources,confirm_token").eq("email", email).maybeSingle();
  let confirmToken = cur?.confirm_token as string | undefined;
  if (!cur) {
    const { data, error } = await db.from("subscribers").insert({ email, lang, sources: [source] }).select("confirm_token").single();
    if (error) return { ok: false, problem: "err" };
    confirmToken = data.confirm_token;
  } else {
    const sources = Array.from(new Set([...(cur.sources || []), source]));
    await db.from("subscribers").update({ sources, ...(cur.status === "unsubscribed" ? { status: "pending" } : {}) }).eq("id", cur.id);
    if (cur.status === "active") return { ok: true, email };
  }
  const url = `${env.siteUrl()}${lang === "en" ? "/en" : ""}/newsletter/confirm?t=${confirmToken}`;
  await sendEmail({ to: email, subject: CONFIRM_COPY[lang].subject, react: createElement(NewsletterConfirm, { lang, url }), log: { template: "newsletter_confirm", entity_type: "subscriber" } });
  return { ok: true, email };
}

/** Double opt-in landing: activates the subscriber and syncs them to the Resend audience for their language. */
export async function confirmSubscription(token: string) {
  if (!/^[0-9a-f]{36}$/.test(token)) return false;
  const db = supabaseAdmin();
  const { data } = await db.from("subscribers").update({ status: "active", confirmed_at: new Date().toISOString() }).eq("confirm_token", token).in("status", ["pending", "active"]).select("*").maybeSingle();
  if (!data) return false;
  await syncSubscriber(data).catch((e) => console.error("resend sync", e));
  return true;
}

export async function unsubscribeToken(token: string) {
  if (!/^[0-9a-f]{36}$/.test(token)) return false;
  const db = supabaseAdmin();
  const { data } = await db.from("subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("unsubscribe_token", token).select("*").maybeSingle();
  if (!data) return false;
  await syncSubscriber(data).catch((e) => console.error("resend sync", e));
  return true;
}
