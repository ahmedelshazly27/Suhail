import { getMe } from "@/lib/auth";
import { answerFields } from "@/lib/data/applications";
import { supabaseServer } from "@/lib/supabase/server";

// CSV of one form's applications (team only). Answers become columns in the form's own order.
export async function GET(req: Request) {
  const me = await getMe();
  if (!me?.active) return new Response("Forbidden", { status: 403 });
  const form = new URL(req.url).searchParams.get("form") || "careers";
  if (!/^[a-z]+$/.test(form)) return new Response("Bad form", { status: 400 });
  const db = await supabaseServer();
  const [{ data: apps }, { data: roles }] = await Promise.all([
    db.from("applications").select("id,created_at,stage,score,email,name,lang,tags,role_id,cv_path,cv_url,answers").eq("form_key", form).is("deleted_at", null).order("created_at"),
    db.from("roles").select("id,slug,form_schema"),
  ]);
  const ids = new Map<string, string>();
  for (const r of form === "careers" ? roles || [] : [null]) for (const f of answerFields(form, r?.form_schema)) if (!ids.has(f.id) && f.type !== "file") ids.set(f.id, f.en);
  const esc = (v: unknown) => { const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); const safe = /^[=+\-@]/.test(s) ? "'" + s : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
  const head = ["id", "received", "stage", "score", "email", "name", "language", "role", "tags", "cv", ...ids.values()];
  const lines = (apps || []).map((a) => [a.id, a.created_at, a.stage, a.score, a.email, a.name, a.lang, roles?.find((r) => r.id === a.role_id)?.slug ?? "", a.tags, a.cv_path ? "uploaded" : a.cv_url ?? "", ...[...ids.keys()].map((k) => (a.answers as Record<string, unknown>)[k])].map(esc).join(","));
  return new Response("﻿" + [head.map(esc).join(","), ...lines].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="suhail-${form}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
