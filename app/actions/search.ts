"use server";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { drive } from "@/lib/m365/drive";

export type Hit = { group: "tickets" | "applicants" | "relationships" | "projects" | "files"; tag: string; label: string; meta: string; href: string };

/** Cmd+K search. Everything goes through RLS as the signed-in teammate; files come from SharePoint when connected. */
export async function search(q: string): Promise<Hit[]> {
  const me = await requireMe();
  const term = z.string().trim().min(1).max(80).safeParse(q);
  if (!term.success) return [];
  const like = `%${term.data.replace(/[%_\\,()]/g, " ")}%`;
  const db = await supabaseServer();
  const keyNum = /^suh-?(\d+)$/i.exec(term.data)?.[1];
  const [t, a, r, p, f] = await Promise.all([
    keyNum ? db.from("tickets").select("key,title,status").eq("number", Number(keyNum)).is("deleted_at", null).limit(1)
      : db.from("tickets").select("key,title,status").ilike("title", like).is("deleted_at", null).order("updated_at", { ascending: false }).limit(6),
    db.from("applications").select("id,name,email,stage,form_key").or(`name.ilike.${like},email.ilike.${like}`).is("deleted_at", null).limit(5),
    db.from("relationships").select("id,name,type,stage").ilike("name", like).limit(4),
    db.from("projects").select("slug,name,status").ilike("name", like).limit(4),
    drive(me.id).then((d) => d.search(term.data)).catch(() => []),
  ]);
  return [
    ...(t.data || []).map((x) => ({ group: "tickets" as const, tag: x.key, label: x.title, meta: x.status.replace("_", " "), href: `/team/tickets/${x.key}` })),
    ...(a.data || []).map((x) => ({ group: "applicants" as const, tag: x.form_key, label: x.name || x.email, meta: x.stage, href: `/team/applications/${x.id}` })),
    ...(r.data || []).map((x) => ({ group: "relationships" as const, tag: x.type, label: x.name, meta: x.stage, href: `/team/relationships?id=${x.id}` })),
    ...(p.data || []).map((x) => ({ group: "projects" as const, tag: "Project", label: x.name, meta: x.status, href: `/team/projects/${x.slug}` })),
    ...f.slice(0, 4).map((x) => ({ group: "files" as const, tag: "SharePoint", label: x.name, meta: x.path, href: x.webUrl })),
  ];
}
