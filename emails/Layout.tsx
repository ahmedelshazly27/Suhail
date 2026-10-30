import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { theme } from "./theme";

// Email layout from design-system/components.md: 560px, paper and ink, Georgia and system sans, star in the footer.
export function Layout({ lang, preview, children, footer, unsubscribeUrl }: { lang: "ar" | "en"; preview: string; children: ReactNode; footer?: string; unsubscribeUrl?: string }) {
  const rtl = lang === "ar";
  return (
    <Html lang={lang} dir={rtl ? "rtl" : "ltr"}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: theme.bg, color: theme.fg, fontFamily: theme.body, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: theme.width, background: theme.bg, padding: "8px 24px", direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>{/* ds-allow: email clients ignore logical properties */}
          <Text style={{ fontFamily: theme.display, fontSize: 18, margin: "0 0 24px" }}>✦ {rtl ? "سهيل" : "Suhail"}</Text>
          {children}
          <Hr style={{ borderColor: theme.line, margin: "32px 0 16px" }} />
          <Section>
            <Text style={{ color: theme.muted, fontSize: 12, lineHeight: "18px", margin: 0 }}>
              ✦ {footer ?? (rtl ? "سهيل، من المحيط إلى الخليج." : "Suhail, from the Atlantic to the Gulf.")}
              {unsubscribeUrl ? <> <Link href={unsubscribeUrl} style={{ color: theme.muted }}>{rtl ? "إلغاء الاشتراك" : "Unsubscribe"}</Link></> : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const P = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 14px" }}>{children}</Text>;
export const H = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: theme.display, fontSize: 26, lineHeight: "34px", margin: "0 0 16px" }}>{children}</Text>;
export const Button = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ display: "inline-block", background: theme.fg, color: theme.bg, padding: "14px 22px", fontSize: 15, textDecoration: "none" }}>{children}</Link>
);
export const Plain = ({ text }: { text: string }) => <>{text.split(/\n{2,}/).map((p, i) => <P key={i}>{p.split("\n").map((l, j) => <span key={j}>{j ? <br /> : null}{l}</span>)}</P>)}</>;
