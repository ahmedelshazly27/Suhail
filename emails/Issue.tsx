import { Layout } from "./Layout";
import { theme } from "./theme";

/** A newsletter issue. `html` is the Tiptap output, already sanitised by lib/rich-text.ts. */
export function Issue({ lang, title, html, unsubscribeUrl }: { lang: "ar" | "en"; title: string; html: string; unsubscribeUrl: string }) {
  return (
    <Layout lang={lang} preview={title} unsubscribeUrl={unsubscribeUrl}
      footer={lang === "ar" ? "وصلك هذا الإيميل لأنك اشتركت في نشرة سهيل." : "You are getting this because you subscribed to the Suhail newsletter."}>
      <div style={{ fontSize: 15, lineHeight: lang === "ar" ? "28px" : "24px", color: theme.fg }} dangerouslySetInnerHTML={{ __html: html }} />
    </Layout>
  );
}
