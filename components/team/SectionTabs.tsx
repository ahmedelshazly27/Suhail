"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TLang } from "@/lib/team-i18n";

// Related pages share one sidebar item and switch with these tabs, so the sidebar stays short.
export const GROUPS = {
  relationships: [["/team/relationships", "Relationships", "العلاقات"], ["/team/outreach", "Outreach", "التواصل"]],
  content: [["/team/content", "Calendar", "التقويم"], ["/team/content/news", "News", "الأخبار"], ["/team/newsletter", "Newsletter", "النشرة"]],
} as const;

export function SectionTabs({ lang, group }: { lang: TLang; group: keyof typeof GROUPS }) {
  const raw = usePathname(), path = raw.startsWith("/team") ? raw : `/team${raw === "/" ? "" : raw}`;
  const tabs = GROUPS[group];
  const cur = tabs.filter(([h]) => path === h || path.startsWith(h + "/")).sort((a, b) => b[0].length - a[0].length)[0]?.[0];
  return (
    <nav className="tabs-u sec-tabs" aria-label={lang === "ar" ? "الأقسام" : "Sections"}>
      {tabs.map(([h, en, ar]) => <Link key={h} href={h} aria-current={cur === h ? "page" : undefined}>{lang === "ar" ? ar : en}</Link>)}
    </nav>
  );
}
