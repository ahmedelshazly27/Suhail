import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Previous caching model: the dashboard is per-user and dynamic, the public site is statically generated per language.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // CVs up to 10 MB
  },
};

export default nextConfig;
