import { Hr } from "@react-email/components";
import { Layout, Plain } from "./Layout";
import { theme } from "./theme";

export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

/** A team-editable template (email_templates). Bilingual mode puts the applicant's language first, then the other. */
export function Templated({ lang, bodyAr, bodyEn, vars, bilingual }: { lang: "ar" | "en"; bodyAr: string; bodyEn: string; vars: Record<string, string>; bilingual?: boolean }) {
  const first = fill(lang === "ar" ? bodyAr : bodyEn, vars);
  const second = fill(lang === "ar" ? bodyEn : bodyAr, vars);
  return (
    <Layout lang={lang} preview={first.split("\n").find((l) => l.trim().length > 12) ?? first.slice(0, 80)}>
      <Plain text={first} />
      {bilingual ? (
        <>
          <Hr style={{ borderColor: theme.line, margin: "24px 0" }} />
          <div dir={lang === "ar" ? "ltr" : "rtl"} lang={lang === "ar" ? "en" : "ar"}><Plain text={second} /></div>
        </>
      ) : null}
    </Layout>
  );
}
