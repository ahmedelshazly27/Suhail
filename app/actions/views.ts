"use server";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

const view = z.object({
  list: z.string().regex(/^[a-z0-9:_-]{2,60}$/),
  layout: z.enum(["table", "board", "list"]),
  group_by: z.string().max(40).nullable(),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  sort: z.array(z.object({ key: z.string().max(40), dir: z.enum(["asc", "desc"]) })).max(3).default([]),
});

/** Saved per person and per list: layout, grouping, filters and sorting. */
export async function saveView(input: z.input<typeof view>) {
  const me = await requireMe();
  const v = view.parse(input);
  const db = await supabaseServer();
  await db.from("saved_views").upsert({ profile_id: me.id, name: "Default", is_default: true, ...v }, { onConflict: "profile_id,list,name" });
}
