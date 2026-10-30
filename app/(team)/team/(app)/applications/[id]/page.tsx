import { notFound } from "next/navigation";
import { ApplicantDetail } from "@/components/team/ApplicantDetail";
import { requireMe } from "@/lib/auth";
import { getApplication } from "@/lib/data/applications";
import { getShell } from "@/lib/data/shell";
import { supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Applicant" };

export default async function ApplicantPage({ params }: PageProps<"/team/applications/[id]">) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabaseServer();
  const [{ lang }, data, shell, tpl] = await Promise.all([teamPrefs(), getApplication(id, me.id), getShell(me.id), db.from("email_templates").select("key,name").order("key")]);
  if (!data) notFound();
  return <div style={{ maxWidth: "46rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}><ApplicantDetail data={data} lang={lang} people={shell.people} templates={tpl.data || []} /></div>;
}
