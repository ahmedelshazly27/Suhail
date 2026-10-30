import { ApplicationsView } from "@/components/team/ApplicationsView";
import { requireMe } from "@/lib/auth";
import { getApplicationsHome } from "@/lib/data/applications";
import { getShell } from "@/lib/data/shell";
import { getView } from "@/lib/data/views";
import { supabaseServer } from "@/lib/supabase/server";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Applications" };

export default async function Applications({ searchParams }: PageProps<"/team/applications">) {
  const me = await requireMe();
  const sp = await searchParams;
  const form = typeof sp.form === "string" && /^[a-z]+$/.test(sp.form) ? sp.form : "careers";
  const db = await supabaseServer();
  const [{ lang }, data, shell, view, tpl] = await Promise.all([teamPrefs(), getApplicationsHome(form), getShell(me.id), getView(me.id, `applications:${form}`, { layout: "board", group_by: "stage", filters: {}, sort: [] }), db.from("email_templates").select("key,name").order("key")]);
  return (
    <>
      <header className="ph"><div className="ph-t"><h1>{tt(lang, "applications")}</h1></div><span className="muted" style={{ fontSize: ".8125rem" }}>{lang === "ar" ? "الطلبات الجديدة توصل هنا وفي قناة Teams" : "New ones arrive here and in the Teams channel"}</span></header>
      <ApplicationsView lang={lang} form={form} forms={data.forms} roles={data.roles} apps={data.apps} people={shell.people} templates={tpl.data || []} layout={view.layout === "table" ? "table" : "board"} />
    </>
  );
}
