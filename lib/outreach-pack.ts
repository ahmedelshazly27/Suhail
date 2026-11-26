import "server-only";
import { z } from "zod";
import pack from "@/content/partners/2026-11.json";
import type { supabaseServer } from "@/lib/supabase/server";

// A research pack: organisations Suhail could partner with, researched once, imported into Relationships and the
// Outreach page with one click. Importing is idempotent: an organisation already there is updated, not duplicated,
// and anything already sent is left alone.

type Db = Awaited<ReturnType<typeof supabaseServer>>;
const s = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const url = z.string().trim().url().max(1000).nullish().catch(null).transform((v) => v || null);
const email = z.string().trim().toLowerCase().email().max(254).nullish().catch(null).transform((v) => v || null);

export const Entry = z.object({
  org: z.string().trim().min(1).max(160),
  segment: z.string().trim().max(80).default(""),
  type: z.string().trim().max(40).default("Partner"),
  country: s(120),
  website: url,
  priority: z.coerce.number().int().min(1).max(3).catch(2).default(2),
  why_them: z.string().trim().max(4000).default(""),
  why_us: z.string().trim().max(4000).default(""),
  ask: z.string().trim().max(1000).default(""),
  programs: z.array(z.string().trim().max(40)).max(12).catch([]).default([]),
  contact: z.object({ name: s(160), role: s(160), linkedin: url, email, email_source: url, form_url: url }).partial().nullish().transform((v) => v ?? {}),
  email: z.object({ subject: z.string().trim().max(200).default(""), body: z.string().trim().max(20000).default("") }).nullish().transform((v) => v ?? { subject: "", body: "" }),
  sources: z.array(z.string().trim().url().max(1000)).max(20).catch([]).default([]),
});
export type Entry = z.infer<typeof Entry>;

export const PACK = { batch: "2026-11", entries: (pack as unknown[]).map((e) => Entry.safeParse(e)).filter((r) => r.success).map((r) => r.data!) };

const TYPES = new Set(["Sponsor", "Partner", "Investor", "Hiring", "Media", "Speaker", "Podcast guest", "Venue", "Judge"]);
const typeOf = (e: Entry) => (TYPES.has(e.type) ? e.type : e.type === "Talent" ? "Hiring" : "Partner");

/** Imports the pack. Returns how many organisations were added and updated. */
export async function importPack(db: Db, by: string) {
  let added = 0, updated = 0;
  const { data: rels } = await db.from("relationships").select("id,name,organisation_id,contact_id");
  const byName = new Map((rels || []).map((r) => [r.name.toLowerCase(), r]));
  for (const e of PACK.entries) {
    const c = e.contact;
    let rel = byName.get(e.org.toLowerCase());
    if (!rel) {
      let orgId: string | null = null;
      const { data: org } = await db.from("organisations").select("id").ilike("name", e.org).maybeSingle();
      if (org) orgId = org.id;
      else orgId = (await db.from("organisations").insert({ name: e.org, website: e.website, created_by: by }).select("id").single()).data?.id ?? null;
      let contactId: string | null = null;
      if (c.name || c.email) contactId = (await db.from("contacts").insert({ name: c.name || e.org, email: c.email, title: c.role || "", organisation_id: orgId, created_by: by }).select("id").single()).data?.id ?? null;
      const { data: r, error } = await db.from("relationships").insert({ name: e.org, organisation_id: orgId, contact_id: contactId, type: typeOf(e), stage: "Prospect", next_step: e.ask.slice(0, 500), created_by: by }).select("id,name,organisation_id,contact_id").single();
      if (error || !r) throw new Error(error?.message || "Could not add a relationship.");
      rel = r; byName.set(e.org.toLowerCase(), r); added++;
      await db.from("relationship_events").insert({ relationship_id: r.id, what: `Researched for partner outreach.\n\n**Why them:** ${e.why_them}\n\n**What we offer:** ${e.why_us}\n\n**First ask:** ${e.ask}`, via: "Research", created_by: by });
    } else updated++;
    const { data: cur } = await db.from("outreach").select("status").eq("relationship_id", rel.id).maybeSingle();
    if (cur && cur.status !== "ready") continue; // never overwrite what someone sent, drafted or skipped
    const row = {
      relationship_id: rel.id, batch: PACK.batch, segment: e.segment, priority: e.priority, country: e.country ?? "", website: e.website,
      why_them: e.why_them, why_us: e.why_us, ask: e.ask, programs: e.programs, sources: e.sources,
      contact_name: c.name ?? null, contact_role: c.role ?? null, linkedin: c.linkedin ?? null, email_source: c.email_source ?? null, form_url: c.form_url ?? null,
      subject: e.email.subject, body: e.email.body,
    };
    const { error } = cur ? await db.from("outreach").update(row).eq("relationship_id", rel.id) : await db.from("outreach").insert({ ...row, created_by: by });
    if (error) throw new Error(error.message);
    if (c.email && rel.contact_id) await db.from("contacts").update({ email: c.email }).eq("id", rel.contact_id).is("email", null);
    else if (c.email && !rel.contact_id) {
      const { data: k } = await db.from("contacts").insert({ name: c.name || e.org, email: c.email, title: c.role || "", organisation_id: rel.organisation_id, created_by: by }).select("id").single();
      if (k) { await db.from("relationships").update({ contact_id: k.id }).eq("id", rel.id); rel.contact_id = k.id; }
    }
  }
  return { added, updated };
}
