import type { Metadata, Viewport } from "next";
import { fontVars } from "@/lib/fonts";
import { teamPrefs } from "@/lib/team-prefs";
import "../../globals.css";
import "@/styles/team.css";

export const metadata: Metadata = { title: { default: "Suhail Team", template: "%s · Suhail Team" }, robots: { index: false, follow: false }, manifest: "/manifest.webmanifest" };
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F6F2" }, { media: "(prefers-color-scheme: dark)", color: "#0B0A09" }], // ds-allow: browser chrome, same as --bg
};

export default async function TeamRoot({ children }: { children: React.ReactNode }) {
  const { lang, theme } = await teamPrefs();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={fontVars} data-theme={theme === "system" ? undefined : theme}>
      <body className="team">{children}</body>
    </html>
  );
}
