import { finishOnboarding } from "@/app/actions/me";
import { Brand } from "@/components/team/Mark";
import { requireMe } from "@/lib/auth";
import { env } from "@/lib/env";
import { tt, type TKey } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata = { title: "You're in" };

export default async function Welcome() {
  const me = await requireMe();
  const { lang } = await teamPrefs();
  const { count } = await supabaseAdmin().from("profiles").select("id", { count: "exact", head: true }).eq("active", true);
  const ms = env.azureReady();
  const rows: [string, string, TKey][] = lang === "ar" ? [
    ["الملف الشخصي والفريق", count && count > 1 ? `الاسم والصورة والمسمّى، و${count} أشخاص في منظمتك` : "الاسم والصورة والمسمّى", "synced"],
    ["بريد Outlook", "بريدك، وhello@ وpartners@ وtasks@", ms ? "live" : "notYet"],
    ["تقويم Outlook", "المواعيد والفعاليات في تقويمك، والإجازات في تخطيط الدورة", ms ? "live" : "notYet"],
    ["Teams", "التنبيهات والاجتماع اليومي والموافقات في المحادثة، وتبويب سهيل", env.teamsWebhook() || env.bot().id ? "connected" : "notYet"],
    ["OneDrive وSharePoint", "أرفق الملفات وابحث فيها بدون ما ترفع نسخ", ms ? "connected" : "notYet"],
    ["Microsoft To Do", "مهامك في قائمة اسمها «سهيل»", "optional"],
  ] : [
    ["Profile and team", count && count > 1 ? `Name, photo, job title, and the ${count} people in your organisation` : "Name, photo and job title", "synced"],
    ["Outlook mail", "Your inbox, plus hello@, partners@ and tasks@", ms ? "live" : "notYet"],
    ["Outlook calendar", "Due dates and events in your calendar, time off in sprint planning", ms ? "live" : "notYet"],
    ["Teams", "Notifications, stand-up and approvals in chat, the Suhail tab", env.teamsWebhook() || env.bot().id ? "connected" : "notYet"],
    ["OneDrive and SharePoint", "Attach and search files without uploading copies", ms ? "connected" : "notYet"],
    ["Microsoft To Do", 'Your assigned tickets in a "Suhail" list', "optional"],
  ];
  return (
    <main className="signin">
      <div className="dither" aria-hidden="true" />
      <div className="signin-box">
        <Brand lang={lang} />
        <div className="signin-card">
          <h1>{tt(lang, "youreIn")}, {me.name.split(" ")[0]}</h1>
          <p className="muted">{tt(lang, "youreInLede")}</p>
          <ul className="synced" style={{ padding: 0, margin: 0 }}>
            {rows.map(([n, w, s]) => <li key={n}><div><b>{n}</b><br /><span>{w}</span></div><i>{tt(lang, s)}</i></li>)}
          </ul>
          <form action={finishOnboarding}><button className="b" type="submit">{tt(lang, "goHome")}</button></form>
        </div>
      </div>
    </main>
  );
}
