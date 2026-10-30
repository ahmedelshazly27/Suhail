import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export type Hackathon = { slug: string; title_en: string; title_ar: string; city_en: string; city_ar: string; fmt: "online" | "inperson"; scene: string; desc_en: string; desc_ar: string };
export type OpenRole = {
  id: string; slug: string; title_en: string; title_ar: string; plain_en: string; plain_ar: string; pitch_en: string; pitch_ar: string;
  do_en: string[]; do_ar: string[]; you_en: string[]; you_ar: string[]; form_schema: unknown[];
};

// Public lists are read with the service role on the server and cached; the anon key has no access to any table.
export const getHackathons = unstable_cache(async (): Promise<Hackathon[]> => {
  if (!env.serviceRole()) return [];
  const { data, error } = await supabaseAdmin().from("hackathons").select("slug,title_en,title_ar,city_en,city_ar,fmt,scene,desc_en,desc_ar").eq("published", true).order("sort");
  if (error) { console.error("hackathons", error.message); return []; }
  return data as Hackathon[];
}, ["hackathons"], { tags: ["hackathons"], revalidate: 300 });

export const getOpenRoles = unstable_cache(async (): Promise<OpenRole[] | null> => {
  if (!env.serviceRole()) return null;
  const { data, error } = await supabaseAdmin().from("roles").select("id,slug,title_en,title_ar,plain_en,plain_ar,pitch_en,pitch_ar,do_en,do_ar,you_en,you_ar,form_schema").eq("status", "open").order("sort");
  if (error) { console.error("roles", error.message); return null; }
  return data as OpenRole[];
}, ["roles"], { tags: ["roles"], revalidate: 300 });
