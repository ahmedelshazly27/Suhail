"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyPeople } from "@/lib/notify";
import { teams } from "@/lib/m365";
import { supabaseServer } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const STAGES = ["Prospect", "Contacted", "In talks", "Confirmed", "Active", "Past"] as const;

// ---------------------------------------------------------------- relationships
const relSchema = z.object({
  name: z.string().trim().min(1).max(200), type: z.string().trim().min(1).max(40), stage: z.enum(STAGES), owner_id: uuid.nullable(),
  next_step: z.string().max(300), next_due: z.string().date().nullable(), project_ids: z.array(uuid).max(20), value: z.number().min(0).nullable(),
}).partial();

export async function saveRelationship(id: string | null, input: z.input<typeof relSchema>) {
  const me = await requireMe();
  const v = relSchema.parse(input);
  const db = await supabaseServer();
  if (!id) {
    const { data } = await db.from("relationships").insert({ name: v.name ?? "New", type: v.type ?? "Partner", stage: v.stage ?? "Prospect", owner_id: v.owner_id ?? me.id, next_step: v.next_step ?? "", next_due: v.next_due ?? null, project_ids: v.project_ids ?? [], created_by: me.id }).select("id").single();
    revalidatePath("/team/relationships");
    return data?.id;
  }
  const { data: before } = await db.from("relationships").select("owner_id,name").eq("id", uuid.parse(id)).single();
  await db.from("relationships").update(v).eq("id", id);
  await logActivity(db, me.id, "relationship", id, "changed", { fields: Object.keys(v), stage: v.stage });
  if (v.stage) await db.from("relationship_events").insert({ relationship_id: id, what: `Moved to ${v.stage}`, via: `By ${me.name}`, created_by: me.id });
  if (v.owner_id && v.owner_id !== before?.owner_id && v.owner_id !== me.id) await notifyPeople([v.owner_id], { kind: "assigned", title: `${me.name} made you owner of ${before?.name}`, entity_type: "relationship", entity_id: id, href: `/team/relationships?id=${id}` });
  revalidatePath("/team/relationships");
  return id;
}

export async function addRelationshipEvent(id: string, what: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  await db.from("relationship_events").insert({ relationship_id: uuid.parse(id), what: z.string().trim().min(1).max(500).parse(what), via: `Note from ${me.name.split(" ")[0]}`, created_by: me.id });
  await db.from("relationships").update({ last_contact_at: new Date().toISOString(), last_contact_via: "Note" }).eq("id", id);
  revalidatePath("/team/relationships");
}

// ---------------------------------------------------------------- content calendar
const contentSchema = z.object({
  channel: z.enum(["linkedin", "instagram", "x", "newsletter", "podcast"]), title: z.string().trim().min(1).max(200),
  status: z.enum(["draft", "in_review", "approved", "scheduled", "published"]), publish_on: z.string().date().nullable(), owner_id: uuid.nullable(), reviewer_id: uuid.nullable(), notes: z.string().max(4000),
}).partial();

export async function saveContent(id: string | null, input: z.input<typeof contentSchema>) {
  const me = await requireMe();
  const v = contentSchema.parse(input);
  const db = await supabaseServer();
  if (!id) { await db.from("content_items").insert({ channel: v.channel ?? "linkedin", title: v.title ?? "Untitled", status: "draft", publish_on: v.publish_on ?? null, owner_id: me.id, created_by: me.id }); }
  else { await db.from("content_items").update(v).eq("id", uuid.parse(id)); await logActivity(db, me.id, "content", id, "changed", { fields: Object.keys(v) }); }
  revalidatePath("/team/content");
}

/** One click: asks the chosen reviewer (default: an owner) to approve, in the dashboard and in Teams. */
export async function requestReview(id: string, reviewer?: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  const target = reviewer ?? (await db.from("profiles").select("id").eq("team_role", "owner").eq("active", true).limit(1).single()).data?.id;
  const { data: c } = await db.from("content_items").update({ status: "in_review", reviewer_id: target }).eq("id", uuid.parse(id)).select("title,channel").single();
  if (target && c) await notifyPeople([target], { kind: "approval", title: `${me.name} requested your review`, body: `${c.channel}: ${c.title}`, entity_type: "content", entity_id: id, href: "/team/content" });
  revalidatePath("/team/content");
}

export async function approveContent(id: string) {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data: c } = await db.from("content_items").update({ status: "approved" }).eq("id", uuid.parse(id)).select("title,owner_id").single();
  await logActivity(db, me.id, "content", id, "approved");
  if (c?.owner_id && c.owner_id !== me.id) await notifyPeople([c.owner_id], { kind: "approval", title: `${me.name} approved "${c.title}"`, entity_type: "content", entity_id: id, href: "/team/content" });
  revalidatePath("/team/content");
}

// ---------------------------------------------------------------- expenses
const expSchema = z.object({
  description: z.string().trim().min(2).max(300), amount: z.coerce.number().positive().max(1_000_000), currency: z.string().length(3).default("KWD"),
  project_id: uuid.nullable(), category: z.string().max(40).nullable(), spent_on: z.string().date(),
});

/** Teammates submit with a receipt. Receipts go to SharePoint Finance/ when connected, else the private receipts bucket. */
export async function submitExpense(form: FormData) {
  const me = await requireMe();
  const v = expSchema.parse({ description: form.get("description"), amount: form.get("amount"), currency: form.get("currency") || "KWD", project_id: form.get("project_id") || null, category: form.get("category") || null, spent_on: form.get("spent_on") });
  const db = await supabaseServer();
  const file = form.get("receipt");
  let receipt_path: string | null = null, receipt_url: string | null = null;
  if (file instanceof File && file.size) {
    if (file.size > 4 * 1024 * 1024 || !/^(application\/pdf|image\/(jpeg|png|heic|webp))$/.test(file.type)) throw new Error("Receipt must be a PDF or image under 4 MB.");
    const { drive } = await import("@/lib/m365/drive");
    const d = await drive(me.id);
    if (d.live) {
      const { delegatedToken } = await import("@/lib/m365/graph");
      const token = await delegatedToken(me.id);
      const r = await fetch(`https://graph.microsoft.com/v1.0/drives/${process.env.SHAREPOINT_DRIVE_ID}/root:/Finance/Receipts/${Date.now()}-${encodeURIComponent(file.name)}:/content`, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: Buffer.from(await file.arrayBuffer()) });
      receipt_url = ((await r.json()) as { webUrl?: string }).webUrl ?? null;
    } else {
      receipt_path = `${me.id}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`;
      const up = await db.storage.from("receipts").upload(receipt_path, file, { contentType: file.type });
      if (up.error) receipt_path = null;
    }
  }
  const { data } = await db.from("expenses").insert({ ...v, receipt_path, receipt_url, created_by: me.id, status: "pending" }).select("id").single();
  const { data: finance } = await db.from("profiles").select("id").eq("active", true).or("functions.cs.{finance},team_role.eq.owner");
  await notifyPeople((finance || []).map((f) => f.id).filter((x) => x !== me.id), { kind: "approval", title: `${me.name} submitted an expense`, body: `${v.description}, ${v.currency} ${v.amount}`, entity_type: "expense", entity_id: data?.id, href: "/team/finance" });
  revalidatePath("/team", "layout");
}

/** Finance approves, rejects or marks paid. RLS allows this only for finance and admins. */
export async function decideExpense(id: string, status: "approved" | "rejected" | "paid", note = "") {
  const me = await requireMe();
  const db = await supabaseServer();
  const { data, error } = await db.from("expenses").update({ status: z.enum(["approved", "rejected", "paid"]).parse(status), approver_id: me.id, decided_at: new Date().toISOString(), decision_note: z.string().max(500).parse(note) }).eq("id", uuid.parse(id)).select("description,amount,currency,created_by").single();
  if (error || !data) throw new Error("Only Finance or an admin can decide expenses.");
  await logActivity(db, me.id, "expense", id, status);
  if (data.created_by && data.created_by !== me.id) await notifyPeople([data.created_by], { kind: "approval", title: `Expense ${status}: ${data.description}`, body: `${data.currency} ${data.amount}${note ? `. ${note}` : ""}`, entity_type: "expense", entity_id: id, href: "/team/finance" });
  if (status === "approved") await teams().channel({ title: `Expense approved: ${data.description}`, text: `${data.currency} ${data.amount}`, href: "/team/finance" }).catch(() => {});
  revalidatePath("/team", "layout");
}
