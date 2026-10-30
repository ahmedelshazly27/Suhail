import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type View = { layout: "table" | "board" | "list"; group_by: string | null; filters: Record<string, string | string[]>; sort: { key: string; dir: "asc" | "desc" }[] };
export async function getView(meId: string, list: string, fallback: View): Promise<View> {
  const db = await supabaseServer();
  const { data } = await db.from("saved_views").select("layout,group_by,filters,sort").eq("profile_id", meId).eq("list", list).eq("name", "Default").maybeSingle();
  return (data as View | null) ?? fallback;
}
