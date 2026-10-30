import { env } from "@/lib/env";
import { appToken, graph } from "@/lib/m365/graph";
import { supabaseAdmin } from "@/lib/supabase/server";
import { teams } from "@/lib/m365";

// Email to ticket: Graph tells us when a message lands in tasks@. "#project-slug" in the subject files it there.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const validation = url.searchParams.get("validationToken");
  if (validation) return new Response(validation, { headers: { "content-type": "text/plain" } });
  const body = (await req.json()) as { value: { clientState?: string; resourceData?: { id: string } }[] };
  const mailbox = env.tasksMailbox();
  if (!mailbox) return new Response(null, { status: 202 });
  const token = await appToken();
  const db = supabaseAdmin();
  for (const n of body.value || []) {
    if (n.clientState !== env.cronSecret() || !n.resourceData?.id) continue;
    const id = n.resourceData.id;
    if ((await db.from("mail_links").select("id").eq("message_id", id).maybeSingle()).data) continue; // already handled
    const m = await graph<{ subject: string; webLink: string; receivedDateTime: string; hasAttachments: boolean; from: { emailAddress: { address: string; name: string } }; body: { content: string } }>(token, `/users/${mailbox}/messages/${id}?$select=subject,webLink,receivedDateTime,hasAttachments,from,body`, { headers: { Prefer: 'outlook.body-content-type="text"' } });
    const sender = m.from.emailAddress.address.toLowerCase();
    const { data: who } = await db.from("profiles").select("id,name").eq("email", sender).eq("active", true).maybeSingle();
    if (!who) continue; // only teammates can create tickets by email
    const tag = /#([a-z0-9-]+)/i.exec(m.subject)?.[1]?.toLowerCase();
    const { data: project } = tag ? await db.from("projects").select("id").eq("slug", tag).maybeSingle() : { data: null };
    const title = m.subject.replace(/^((re|fw|fwd)\s*:\s*)+/i, "").replace(/#[a-z0-9-]+/gi, "").trim() || "Email";
    const { data: t } = await db.from("tickets").insert({
      title, status: "todo", assignee_id: who.id, project_id: project?.id ?? null, source: "email", source_ref: m.webLink, created_by: who.id,
      description: { type: "doc", content: m.body.content.split(/\n{2,}/).slice(0, 40).map((p) => ({ type: "paragraph", content: p.trim() ? [{ type: "text", text: p.trim().slice(0, 4000) }] : [] })) },
    }).select("id,key").single();
    if (!t) continue;
    await db.from("mail_links").insert({ mailbox, message_id: id, subject: m.subject, from_email: sender, received_at: m.receivedDateTime, web_link: m.webLink, entity_type: "ticket", entity_id: t.id, created_by: who.id });
    if (m.hasAttachments) await db.from("file_links").insert({ web_url: m.webLink, name: "Attachments in the original email", kind: "EMAIL", entity_type: "ticket", entity_id: t.id, created_by: who.id });
    await db.from("activity").insert({ entity_type: "ticket", entity_id: t.id, actor_id: who.id, verb: "created", data: { via: "email", mailbox } });
    const link = `${env.siteUrl()}/team/tickets/${t.key}`;
    await graph(token, `/users/${mailbox}/messages/${id}/reply`, { method: "POST", body: JSON.stringify({ comment: `Created ${t.key}: ${link}` }) }).catch(() => {});
    await teams().personal(who.id, { title: `${t.key} created from your email`, text: title, href: `/team/tickets/${t.key}` }).catch(() => {});
  }
  return new Response(null, { status: 202 });
}
