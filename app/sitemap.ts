import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { href } from "@/lib/i18n";

const PAGES = ["/", "/manifesto", "/careers", "/season", "/hackathons", "/house", "/jobs", "/partners", "/podcast"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl();
  return PAGES.flatMap((p) => (["ar", "en"] as const).map((lang) => ({
    url: base + href(lang, p),
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1 : 0.7,
    alternates: { languages: { ar: base + href("ar", p), en: base + href("en", p) } },
  })));
}
