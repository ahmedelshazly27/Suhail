import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const prod = env.isProduction();
  return {
    rules: prod ? [{ userAgent: "*", allow: "/", disallow: ["/team", "/api", "/auth", "/newsletter/"] }] : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${env.siteUrl()}/sitemap.xml`,
  };
}
