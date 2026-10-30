import Link from "next/link";
import { href, t, type Lang } from "@/lib/i18n";

/** The bar the prototype prepends to every page that is coming soon. */
export const SoonBar = ({ lang }: { lang: Lang }) => (
  <div className="wrap soonbar"><span className="soontag">{t(lang, "soon")}</span><span className="muted">{t(lang, "soon_page")}</span></div>
);

/** Placeholder block shown where a list is still empty. Links to the newsletter signup on home. */
export const SoonBlock = ({ lang }: { lang: Lang }) => (
  <div className="soonblock">
    <span className="eyebrow">{t(lang, "soon")}</span>
    <p className="muted">{t(lang, "soon_p")}</p>
    <Link className="arrowlink" href={href(lang, "/") + "#subscribe"}>{t(lang, "soon_a")}</Link>
  </div>
);
