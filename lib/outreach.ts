import "server-only";
import type { Me } from "@/lib/auth";
import { emailHtml } from "@/lib/email/signature";
import { mail } from "@/lib/m365/mail";
import type { supabaseServer } from "@/lib/supabase/server";

// Writing an email to a relationship from the signed-in person's own Outlook. Server-only: callers pass the person
// from requireMe(), never from the browser.

type Db = Awaited<ReturnType<typeof supabaseServer>>;
export type OutgoingEmail = { relationship_id: string; to: string; subject: string; body: string; send: boolean };

/** Shared with approving an agent's lead: one place that writes the email, keeps the contact and logs it. */
export async function writeEmail(db: Db, me: Me, v: OutgoingEmail, via = "Outlook") {
  const { data: rel } = await db.from("relationships").select("id,stage,contact_id,organisation_id,name").eq("id", v.relationship_id).single();
  if (!rel) throw new Error("Relationship not found.");
  let res: { id: string; webLink: string };
  try {
    res = await (await mail(me.id)).compose({ to: v.to, subject: v.subject, html: emailHtml(v.body, me), send: v.send });
  } catch (e) {
    const m = (e as Error).message;
    throw new Error(m.includes("graph 401") || m.includes("graph 403") ? "Outlook didn't accept this. Sign out and back in with Microsoft, then try again." : m);
  }
  // Keep the address on the relationship's contact so the next email is one click.
  if (rel.contact_id) await db.from("contacts").update({ email: v.to }).eq("id", rel.contact_id).is("email", null);
  else {
    const { data: c } = await db.from("contacts").insert({ name: rel.name.slice(0, 120), email: v.to, organisation_id: rel.organisation_id }).select("id").single();
    if (c) await db.from("relationships").update({ contact_id: c.id }).eq("id", rel.id);
  }
  await db.from("relationship_events").insert({
    relationship_id: rel.id, what: `${v.send ? "Emailed" : "Draft in Outlook"}: **${v.subject}**\n\n${v.body.slice(0, 4000)}${res.webLink ? `\n\n[Open in Outlook](${res.webLink})` : ""}`,
    via: `${via} · ${me.name.split(" ")[0]}`, created_by: me.id,
  });
  if (v.send) await db.from("relationships").update({ last_contact_at: new Date().toISOString(), last_contact_via: "Email", ...(rel.stage === "Prospect" ? { stage: "Contacted" } : {}) }).eq("id", rel.id);
  return { webLink: res.webLink, sent: v.send };
}
