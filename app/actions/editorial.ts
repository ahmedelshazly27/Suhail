"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { textToDoc } from "@/lib/agents";
import { supabaseServer } from "@/lib/supabase/server";

// The editor's Write tool in Content: pick a format and an angle, choose stories from the news archive, then either
// ask the Writer agent to draft it (it runs at the next shift, on the Claude plan) or start the draft yourself.

const FORMATS = { linkedin: "LinkedIn post", x: "X thread", instagram: "Instagram caption", weekly: "weekly newsletter", monthly: "monthly newsletter" } as const;
const write = z.object({
  format: z.enum(["linkedin", "x", "instagram", "weekly", "monthly"]),
  lang: z.enum(["ar", "en", "both"]),
  angle: z.string().trim().max(600).default(""),
  items: z.array(z.string().uuid()).min(1).max(40),
  by: z.enum(["writer", "me"]),
});

type Story = { id: string; title: string; body: string; sources: { url: string; title?: string }[] };

export async function writeFromNews(input: z.input<typeof write>): Promise<{ kind: "asked" | "newsletter" | "content"; id?: string }> {
  const me = await requireMe();
  const v = write.parse(input);
  const db = await supabaseServer();
  const { data } = await db.from("agent_items").select("id,title,body,sources").in("id", v.items);
  const stories = ((data || []) as Story[]).sort((a, b) => v.items.indexOf(a.id) - v.items.indexOf(b.id));
  if (!stories.length) throw new Error("Those stories aren't in the archive any more.");
  const what = FORMATS[v.format], language = v.lang === "both" ? "Arabic and English" : v.lang === "ar" ? "Arabic" : "English";

  if (v.by === "writer") {
    let body = `Write a ${what} in ${language}.${v.angle ? ` Angle: ${v.angle}` : ""}\nUse these archive items (ids):\n`;
    for (const s of stories) { const line = `- ${s.id}: ${s.title}\n`; if (body.length + line.length > 1950) break; body += line; }
    const { error } = await db.from("agent_requests").insert({ agent_key: "writer", body });
    if (error) throw new Error(error.message);
    revalidatePath("/team/agents");
    return { kind: "asked" };
  }

  // Start it yourself: the picked stories as an outline, with their sources.
  const outline = stories.map((s) => `${s.title}\n${s.body.split("\n").find((l) => l.trim().length > 30)?.slice(0, 400) ?? ""}\n${s.sources.slice(0, 3).map((x) => x.url).join("\n")}`).join("\n\n");
  const title = (v.angle || stories[0].title).slice(0, 200);
  if (v.format === "weekly" || v.format === "monthly") {
    const doc = textToDoc(`${v.angle ? v.angle + "\n\n" : ""}${outline}`);
    const ar = v.lang === "ar";
    const { data: row, error } = await db.from("newsletter_issues").insert({ title, [ar ? "subject_ar" : "subject_en"]: title, [ar ? "body_ar" : "body_en"]: doc, ...(v.lang === "both" ? { body_ar: doc } : {}), segment: v.lang, created_by: me.id }).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/team/newsletter");
    return { kind: "newsletter", id: row.id };
  }
  const { data: row, error } = await db.from("content_items").insert({ channel: v.format, title, status: "draft", owner_id: me.id, notes: `${what}, ${language}.\n\n${outline}`.slice(0, 20000) }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/team/content");
  return { kind: "content", id: row.id };
}
