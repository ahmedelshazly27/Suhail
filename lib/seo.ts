import type { Metadata } from "next";
import { env } from "@/lib/env";
import { href, t, type Key, type Lang } from "@/lib/i18n";

/** Title, description, canonical URL and hreflang pair for a public page. */
export function pageMeta(lang: Lang, path: string, navKey: Key | null, description: string): Metadata {
  const brand = t(lang, "brand");
  const title = navKey ? `${brand} · ${t(lang, navKey)}` : brand;
  const base = env.siteUrl();
  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: { canonical: href(lang, path), languages: { ar: href("ar", path), en: href("en", path), "x-default": href("ar", path) } },
    openGraph: { title, description, siteName: brand, locale: lang === "ar" ? "ar_AR" : "en_US", alternateLocale: lang === "ar" ? "en_US" : "ar_AR", type: "website", url: href(lang, path) },
    twitter: { card: "summary_large_image", title, description },
  };
}
