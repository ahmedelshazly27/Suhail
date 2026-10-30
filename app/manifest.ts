import type { MetadataRoute } from "next";
import tokens from "@/design-system/tokens.json";

// Installable dashboard (PWA). Opens straight into the team app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suhail Team", short_name: "Suhail", start_url: "/team", scope: "/team", display: "standalone",
    background_color: tokens.light.bg, theme_color: tokens.light.bg,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
