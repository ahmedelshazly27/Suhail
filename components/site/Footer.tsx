import Link from "next/link";
import { href, t, type Lang } from "@/lib/i18n";
import { Scene } from "./Scene";

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer>
      <div className="scene-wrap"><Scene kind="skyline" style={{ height: 90 }} /></div>
      <div className="wrap">
        <span>{t(lang, "brand")}</span>
        <nav aria-label={lang === "ar" ? "التذييل" : "Footer"}>
          <Link href={href(lang, "/manifesto")}>{t(lang, "nav_manifesto")}</Link>
          <Link href={href(lang, "/careers")}>{t(lang, "nav_careers")}</Link>
        </nav>
      </div>
    </footer>
  );
}
