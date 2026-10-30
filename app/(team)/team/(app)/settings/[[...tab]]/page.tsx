import Link from "next/link";
import { General, Lists, Members, MeSettings, Pipelines, RoleEditor, Templates } from "@/components/team/Settings";
import { isAdmin, requireMe } from "@/lib/auth";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { tt, type TKey } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Settings" };
const TABS: [string, TKey, boolean][] = [["me", "settings", false], ["members", "members", true], ["pipelines", "pipelines", true], ["roles", "roles", true], ["templates", "emailTemplates", true], ["lists", "templates", true], ["general", "m365", true]];

export default async function SettingsPage({ params }: PageProps<"/team/settings/[[...tab]]">) {
  const me = await requireMe();
  const { lang, theme } = await teamPrefs();
  const tab = ((await params).tab?.[0] === "microsoft" ? "general" : (await params).tab?.[0]) ?? "me";
  const admin = isAdmin(me);
  const db = await supabaseServer();
  const can = (t: string) => !TABS.find((x) => x[0] === t)?.[2] || admin;
  let body: React.ReactNode = <p className="muted">{tt(lang, "forbidden")}</p>;
  if (can(tab)) {
    if (tab === "me") body = <MeSettings lang={lang} theme={theme} me={{ ...me, capacity: (await db.from("profiles").select("capacity").eq("id", me.id).single()).data?.capacity ?? 8 }} icsUrl={`${env.siteUrl()}/api/ics/${me.ics_token}`} teamIcsUrl={`${env.siteUrl()}/api/ics/team/${(await import("@/lib/ics")).teamToken()}`} />;
    if (tab === "members") body = <Members lang={lang} rows={(await db.from("profiles").select("id,name,email,job_title,team_role,functions,active,capacity,ms_groups").order("name")).data || []} />;
    if (tab === "pipelines") body = <Pipelines lang={lang} forms={(await db.from("forms").select("key,name_en,name_ar,stages").order("key")).data || []} />;
    if (tab === "roles") body = <RoleEditor lang={lang} roles={(await db.from("roles").select("*").order("sort")).data || []} />;
    if (tab === "templates") body = <Templates lang={lang} rows={(await db.from("email_templates").select("*").order("key")).data || []} />;
    if (tab === "lists") body = <Lists lang={lang} labels={(await db.from("labels").select("id,name,attention").order("name")).data || []} categories={(await db.from("expense_categories").select("key,name").order("name")).data || []} templates={(await db.from("project_templates").select("key,name,items").order("name")).data || []} />;
    if (tab === "general") body = <General lang={lang} s={(await db.from("settings").select("data").single()).data?.data} status={{ azure: env.azureReady(), webhook: !!env.teamsWebhook(), bot: !!(env.bot().id && env.bot().password), tasks: env.tasksMailbox(), drive: !!process.env.SHAREPOINT_DRIVE_ID }} />;
  }
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">{me.name}</span><h1>{tt(lang, "settings")}</h1></div></header>
      <nav className="tabs-u">{TABS.filter(([, , a]) => !a || admin).map(([k, label]) => <Link key={k} href={k === "me" ? "/team/settings" : `/team/settings/${k}`} aria-current={tab === k ? "page" : undefined}>{k === "me" ? (lang === "ar" ? "حسابي" : "Me") : k === "lists" ? (lang === "ar" ? "القوائم والقوالب" : "Lists and templates") : k === "general" ? (lang === "ar" ? "عام وMicrosoft 365" : "General and Microsoft 365") : tt(lang, label)}</Link>)}</nav>
      {body}
    </>
  );
}
