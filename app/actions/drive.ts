"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { drive } from "@/lib/m365/drive";
import { delegatedToken } from "@/lib/m365/graph";
import { supabaseServer } from "@/lib/supabase/server";

const needLive = async (id: string) => { const d = await drive(id); if (!d.live) throw new Error("The shared drive connects once Microsoft 365 is set up."); return d; };

export async function newFolder(parent: string, name: string) {
  const me = await requireMe();
  const d = await needLive(me.id);
  await d.createFolder(z.string().min(1).max(200).parse(parent), z.string().trim().min(1).max(120).parse(name));
  revalidatePath("/team/drive");
}

export async function newOfficeDoc(parent: string, kind: "docx" | "xlsx" | "pptx", name: string) {
  const me = await requireMe();
  const d = await needLive(me.id);
  const item = await d.createOffice(parent, z.enum(["docx", "xlsx", "pptx"]).parse(kind), z.string().trim().min(1).max(120).parse(name));
  revalidatePath("/team/drive");
  return item.webUrl;
}

/** Small uploads (up to 4 MB) go straight to the folder; bigger files are uploaded from OneDrive or Teams. */
export async function uploadToDrive(form: FormData) {
  const me = await requireMe();
  await needLive(me.id);
  const parent = z.string().min(1).max(200).parse(form.get("parent"));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) throw new Error("Choose a file under 4 MB.");
  const token = await delegatedToken(me.id);
  await fetch(`https://graph.microsoft.com/v1.0/drives/${process.env.SHAREPOINT_DRIVE_ID}/items/${parent}:/${encodeURIComponent(file.name)}:/content`, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: Buffer.from(await file.arrayBuffer()) });
  revalidatePath("/team/drive");
}

/** Attach a drive file to any record. It's a link, never a copy. */
export async function attachFile(input: { entity_type: string; entity_id: string; web_url: string; name: string; drive_item_id?: string | null }) {
  const me = await requireMe();
  const v = z.object({ entity_type: z.enum(["ticket", "project", "relationship", "expense", "application", "content"]), entity_id: z.string().uuid(), web_url: z.string().url().max(2000), name: z.string().min(1).max(300), drive_item_id: z.string().max(200).nullish() }).parse(input);
  const db = await supabaseServer();
  await db.from("file_links").insert({ ...v, kind: v.name.split(".").pop()?.toUpperCase() ?? "FILE", created_by: me.id });
  revalidatePath("/team", "layout");
}
