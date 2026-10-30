"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { href, t, type Lang } from "@/lib/i18n";
import { Star } from "./Star";
import { WordmarkAr } from "@/components/ui/Wordmark";

// The prototype hides the nav links for pages that are coming soon; only these two show.
const NAV = [["/manifesto", "nav_manifesto"], ["/careers", "nav_careers"]] as const;

export function Header({ lang }: { lang: Lang }) {
  const path = (usePathname() || "/").replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
  const other: Lang = lang === "ar" ? "en" : "ar";
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href={href(lang)} aria-label={t(lang, "home")}>
          <Star /><span className="w">{lang === "ar" ? <WordmarkAr /> : t(lang, "brand")}</span>
        </Link>
        <nav className="links" aria-label={lang === "ar" ? "الصفحات" : "Pages"}>
          {NAV.map(([p, k]) => (
            <Link key={p} href={href(lang, p)} aria-current={path === p || path.startsWith(p + "/") ? "page" : undefined}>{t(lang, k)}</Link>
          ))}
        </nav>
        <Link className="lang" href={href(other, path)} hrefLang={other} prefetch={false}
          onClick={() => { try { document.cookie = `suhail-lang=${other};path=/;max-age=31536000;samesite=lax`; } catch {} }}>
          {lang === "ar" ? "EN" : <span className="ar" lang="ar">عربي</span>}<span className="vh-sr"> · {t(lang, "langlabel")}</span>
        </Link>
      </div>
    </header>
  );
}
