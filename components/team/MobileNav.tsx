"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Mark } from "./Mark";
import { openPalette } from "./Palette";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";

const I = {
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>,
  work: <><path d="M5 6h14M5 12h14M5 18h9" /></>,
  drive: <><path d="M3 7h7l2 2h9v10H3z" /></>,
  more: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
};
const TABS: [TKey, string, keyof typeof I][] = [["home", "/team", "home"], ["inbox", "/team/inbox", "inbox"], ["work", "/team/my-work", "work"], ["drive", "/team/drive", "drive"], ["more", "/team/more", "more"]];
const TITLE: [string, TKey][] = [["/team/inbox", "inbox"], ["/team/my-work", "myWork"], ["/team/projects", "projects"], ["/team/tickets", "projects"], ["/team/sprints", "sprints"], ["/team/applications", "applications"],
  ["/team/relationships", "relationships"], ["/team/content", "content"], ["/team/newsletter", "newsletter"], ["/team/drive", "drive"], ["/team/finance", "finance"], ["/team/settings", "settings"], ["/team/more", "more"], ["/team/design", "design"]];

/** Phone layout from reference/mobile-prototype.html: sticky header and a five-tab bar with 44px+ targets. */
export function MobileNav({ lang, me, inbox }: { lang: TLang; me: { name: string; avatar_url: string | null }; inbox: number }) {
  const path = usePathname();
  const title = TITLE.find(([p]) => path.startsWith(p))?.[1] ?? "home";
  const cur = (href: string) => (href === "/team" ? path === "/team" : path.startsWith(href) || (href === "/team/more" && /\/team\/(projects|tickets|sprints|applications|relationships|content|newsletter|finance|settings)/.test(path)));
  return (
    <>
      <header className="m-top">
        <Mark />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span className="sub">{lang === "ar" ? "سهيل" : "Suhail"}</span><h1>{tt(lang, title)}</h1></div>
        <span className="spacer" />
        <button type="button" className="iconbtn" aria-label={tt(lang, "search")} onClick={() => openPalette()}>
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.4" /></svg>
        </button>
        <Link href="/team/settings" aria-label={tt(lang, "settings")}><Avatar name={me.name} src={me.avatar_url} size="lg" /></Link>
      </header>
      <nav className="m-tabs" aria-label={lang === "ar" ? "التنقل" : "Navigation"}>
        <div className="in">
          {TABS.map(([k, href, ic]) => (
            <Link key={href} href={href} className="m-tab" aria-current={cur(href) ? "page" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{I[ic]}</svg>
              {tt(lang, k)}
              {k === "inbox" && inbox ? <span className="badge">{inbox}</span> : null}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
