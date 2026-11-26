import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LangToggle, SignOut } from "@/components/members/Forms";
import { Star } from "@/components/site/Star";
import { supabaseServer } from "@/lib/supabase/server";
import { fontVars, preloadDisplayFont } from "@/lib/fonts";
import { getMember, memberLang } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import "../../globals.css";
import "@/styles/team.css";
import "@/styles/members.css";

export const metadata: Metadata = { title: { default: "Suhail Members", template: "%s · Suhail Members" }, robots: { index: false, follow: false } };
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F6F2" }, { media: "(prefers-color-scheme: dark)", color: "#0B0A09" }], // ds-allow: browser chrome, same as --bg
};

const NAV = [["home", "/members"], ["people", "/members/people"], ["opps", "/members/opportunities"], ["board", "/members/board"], ["ask", "/members/ask"]] as const;
const TABS = [["home", "/members"], ["people", "/members/people"], ["opps", "/members/opportunities"], ["board", "/members/board"], ["me", "/members/me"]] as const;

export default async function MembersRoot({ children }: { children: React.ReactNode }) {
  const me = await getMember();
  const lang = await memberLang(me);
  const t = mt(lang);
  const inside = me?.status === "active";
  preloadDisplayFont(lang);
  const pending = inside ? (await (await supabaseServer()).from("member_intros").select("id", { count: "exact", head: true }).eq("to_id", me!.id).eq("status", "pending")).count ?? 0 : 0;
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={fontVars}>
      <body className="team mb">
        <header className="mb-top">
          <Link href="/members" className="brandmark" aria-label={t.app}><Star /><span className="w">{lang === "ar" ? "سهيل" : "Suhail"}</span><span className="t">{lang === "ar" ? "الأعضاء" : "Members"}</span></Link>
          {inside ? <nav className="mb-nav" aria-label={t.app}>{NAV.map(([k, h]) => <Link key={k} href={h}>{t[k]}</Link>)}</nav> : null}
          <div className="mb-tools">
            {inside ? <><Link href="/members/intros" className="mb-pill">{t.intros}{pending ? <span className="mb-badge">{pending}</span> : null}</Link><Link href="/members/invite" className="mb-pill">{t.invite}</Link><Link href="/members/me" className="mb-pill">{t.me}</Link></> : null}
            <LangToggle lang={lang} />{inside ? <SignOut t={t} /> : null}
          </div>
        </header>
        <main id="main" className="mb-main">{children}</main>
        {inside ? <nav className="mb-tabs" aria-label={t.app}>{TABS.map(([k, h]) => <Link key={k} href={h}>{t[k]}</Link>)}</nav> : null}
      </body>
    </html>
  );
}
