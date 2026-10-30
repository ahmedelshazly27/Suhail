// Form schemas, shared by the public forms, the server validation and the dashboard's answer rendering.
// The shape is the prototype's FORMS / ROLE_FORMS, stored as JSON (content/forms.json, roles.form_schema).
import countries from "@/content/countries.json";
import formsJson from "@/content/forms.json";
import careers from "@/content/careers.json";

export type Opt = [value: string, en: string, ar: string];
export type Field = {
  id: string; en: string; ar: string;
  type: "text" | "email" | "select" | "radio" | "checks" | "textarea" | "file" | "head";
  req?: number | boolean; opts?: Opt[] | "@countries" | "@hackathons"; ltr?: number | boolean; ph?: string; max?: number; note?: [string, string]; accept?: string; when?: string;
};
export type Row = Field | Field[];
export type FormDef = { coll: string; submit: [string, string]; fields: Row[] };

export const STATIC_FORMS = formsJson as unknown as Record<string, FormDef>;
export const PUBLIC_FORM_KEYS = ["hack", "house", "talent", "cofounder", "company", "season", "partner", "podcast"] as const;
export type PublicFormKey = (typeof PUBLIC_FORM_KEYS)[number];

export const COUNTRY_OPTS: Opt[] = (countries as [string, string][]).map(([en, ar]) => [en, en, ar]);

/** Careers: shared basics, the role's own task, then the shared closing fields. */
export function careersFields(roleSchema: unknown): Row[] {
  return [...(careers.basics as Row[]), ...((roleSchema as Row[]) || []), ...(careers.close as Row[])];
}
export const CAREERS_SUBMIT: [string, string] = ["Send application", "أرسل الطلب"];

export function resolveOpts(f: Field, hackathons: Opt[] = []): Opt[] {
  if (f.opts === "@countries") return COUNTRY_OPTS;
  if (f.opts === "@hackathons") return hackathons;
  return f.opts || [];
}

export const flat = (rows: Row[]) => rows.flat().filter((f) => f.type !== "head");
export const words = (s: string) => (s.trim().match(/\S+/g) || []).length;

export type Answers = Record<string, string | string[]>;
export type Problem = "required" | "too_long" | "bad_email" | "cv_need" | "cv_bad" | "bad_option";

/** Same checks the prototype runs in the browser, run again on the server. Returns the first problem or null. */
export function checkAnswers(rows: Row[], v: Answers, opts: { hackathons?: Opt[] } = {}): Problem | null {
  const fields = flat(rows).filter((f) => !f.when || f.when === v.role);
  const empty = (x: unknown) => (Array.isArray(x) ? !x.length : !x);
  if (fields.some((f) => f.req && f.type !== "file" && empty(v[f.id]))) return "required";
  if (fields.some((f) => f.max && typeof v[f.id] === "string" && words(v[f.id] as string) > f.max!)) return "too_long";
  const email = (v.email as string) || "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "bad_email";
  for (const f of fields) {
    if (!["select", "radio", "checks"].includes(f.type) || empty(v[f.id])) continue;
    const allowed = new Set(resolveOpts(f, opts.hackathons).map((o) => o[0]));
    const vals = Array.isArray(v[f.id]) ? (v[f.id] as string[]) : [v[f.id] as string];
    if (vals.some((x) => !allowed.has(x))) return "bad_option";
  }
  return null;
}

