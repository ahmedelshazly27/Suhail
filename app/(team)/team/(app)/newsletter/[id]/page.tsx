import { notFound } from "next/navigation";
import { Composer } from "@/components/team/Composer";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Newsletter issue" };

export default async function Page({ params }: PageProps<"/team/newsletter/[id]">) {
  await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabaseServer();
  const [{ lang }, { data: issue }, ar, en, last] = await Promise.all([teamPrefs(), db.from("newsletter_issues").select("*").eq("id", id).maybeSingle(),
    db.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active").eq("lang", "ar"),
    db.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active").eq("lang", "en"),
    db.from("newsletter_issues").select("id").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle()]);
  if (!issue) notFound();
  let lastStats = "";
  if (last.data) {
    const { data: ev } = await db.from("email_events").select("type,email").eq("issue_id", last.data.id);
    const n = (t: string) => new Set((ev || []).filter((e) => e.type === t).map((e) => e.email)).size;
    const del = n("email.delivered");
    if (del) lastStats = `${Math.round((n("email.opened") / del) * 100)}% opened, ${((n("contact.unsubscribed") / del) * 100).toFixed(1)}% unsubscribed`;
  }
  return <Composer lang={lang} issue={issue} audience={{ ar: ar.count ?? 0, en: en.count ?? 0 }} lastStats={lastStats} broadcastsOn={process.env.MAIL_ALLOWLIST === "*"} />;
}
