import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Previous caching model: the dashboard is per-user and dynamic, the public site is statically generated per language.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // Self-hosted display fonts (styles/fonts.css). Their URLs carry ?v=, so they can be cached for good.
  headers: async () => [{ source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }],
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // CVs up to 10 MB
  },
};

export default nextConfig;
