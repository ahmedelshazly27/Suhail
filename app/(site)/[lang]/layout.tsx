import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { fontVars } from "@/lib/fonts";
import { dir, isLang, LANGS } from "@/lib/i18n";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import "../../globals.css";
import "@/styles/site.css";

export const dynamicParams = false;
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F6F2" }, { media: "(prefers-color-scheme: dark)", color: "#0B0A09" }], // ds-allow: browser chrome needs literal colours, same as --bg
};

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} dir={dir(lang)} className={fontVars}>
      <body>
        <a className="vh-sr skip" href="#main">{lang === "ar" ? "انتقل للمحتوى" : "Skip to content"}</a>
        <Header lang={lang} />
        <main id="main">{children}</main>
        <Footer lang={lang} />
      </body>
    </html>
  );
}
