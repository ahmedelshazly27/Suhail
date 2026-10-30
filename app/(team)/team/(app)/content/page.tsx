import { ContentCalendar, type Item } from "@/components/team/ContentCalendar";
import { requireMe } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { getShell } from "@/lib/data/shell";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Content calendar" };

export default async function Page({ searchParams }: PageProps<"/team/content">) {
  const me = await requireMe();
  const sp = await searchParams;
  const month = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : todayISO().slice(0, 7);
  const db = await supabaseServer();
  const [{ lang }, shell, { data }] = await Promise.all([teamPrefs(), getShell(me.id),
    db.from("content_items").select("id,channel,title,status,publish_on,owner_id,reviewer_id,notes").or(`and(publish_on.gte.${addDays(month + "-01", -7)},publish_on.lte.${addDays(month + "-01", 45)}),status.eq.in_review`).order("publish_on")]);
  // Event days (a project's target date, and the day after for two-day events like hackathons) are tinted.
  const { data: ev } = await db.from("projects").select("target_date,template_key").not("target_date", "is", null).in("template_key", ["hackathon", "event"]);
  const eventDays = (ev || []).flatMap((p) => (p.template_key === "hackathon" ? [p.target_date as string, addDays(p.target_date as string, -1)] : [p.target_date as string]));
  return <ContentCalendar lang={lang} month={month} items={(data || []) as Item[]} people={shell.people} meId={me.id} eventDays={eventDays} />;
}
