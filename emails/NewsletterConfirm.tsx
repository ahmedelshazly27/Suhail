import { Hr } from "@react-email/components";
import { Button, Layout, P } from "./Layout";
import { theme } from "./theme";

export const CONFIRM_COPY = {
  ar: { subject: "أكّد اشتراكك في نشرة سهيل", body: "اضغط الزر عشان نبدأ نرسل لك. إذا ما اشتركت، تجاهل هذا الإيميل.", cta: "أكّد الاشتراك" },
  en: { subject: "Confirm your Suhail newsletter subscription", body: "Press the button and we'll start sending. If you didn't subscribe, ignore this email.", cta: "Confirm subscription" },
};

export function NewsletterConfirm({ lang, url }: { lang: "ar" | "en"; url: string }) {
  const a = CONFIRM_COPY[lang], b = CONFIRM_COPY[lang === "ar" ? "en" : "ar"];
  return (
    <Layout lang={lang} preview={a.body}>
      <P>{a.body}</P>
      <Button href={url}>{a.cta}</Button>
      <Hr style={{ borderColor: theme.line, margin: "28px 0" }} />
      <div dir={lang === "ar" ? "ltr" : "rtl"}><P>{b.body}</P><Button href={url}>{b.cta}</Button></div>
    </Layout>
  );
}
