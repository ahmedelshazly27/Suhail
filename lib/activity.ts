import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Append-only audit entry as the signed-in teammate (RLS checks actor_id = auth.uid()). */
export async function logActivity(db: SupabaseClient, actorId: string, entity_type: string, entity_id: string, verb: string, data: Record<string, unknown> = {}) {
  await db.from("activity").insert({ entity_type, entity_id, actor_id: actorId, verb, data });
}

/** @mentions in a Tiptap document: mention nodes carry the profile id. */
export function mentionsIn(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; attrs?: { id?: string }; content?: unknown[] };
    if (node.type === "mention" && node.attrs?.id) out.add(node.attrs.id);
    node.content?.forEach(walk);
  };
  walk(doc);
  return [...out];
}

/** Plain text of a Tiptap document, for notifications and search. */
export function plainText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; attrs?: { label?: string }; content?: unknown[] };
    if (node.text) parts.push(node.text);
    if (node.type === "mention") parts.push("@" + (node.attrs?.label ?? ""));
    node.content?.forEach(walk);
    if (node.type === "paragraph") parts.push("\n");
  };
  walk(doc);
  return parts.join("").trim();
}
