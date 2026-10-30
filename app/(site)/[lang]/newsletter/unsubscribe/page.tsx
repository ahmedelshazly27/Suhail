import Link from "next/link";
import { unsubscribeToken } from "@/app/actions/public";
import { href, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };
const C = {
  ar: { ok: "ألغينا اشتراكك. ما بتوصلك رسائل منّا بعد اليوم.", bad: "الرابط ما يشتغل أو انتهى.", home: "الرئيسية" },
  en: { ok: "You're unsubscribed. You won't get any more emails from us.", bad: "This link doesn't work or has expired.", home: "Home" },
};

export default async function Unsubscribe({ params, searchParams }: PageProps<"/[lang]/newsletter/unsubscribe">) {
  const lang = (await params).lang as Lang;
  const tok = (await searchParams).t;
  const ok = typeof tok === "string" && (await unsubscribeToken(tok));
  return (
    <section className="page on"><div className="wrap hero">
      <h1>{lang === "ar" ? "النشرة" : "Newsletter"}</h1>
      <p className="text muted" role="status">{ok ? C[lang].ok : C[lang].bad}</p>
      <p><Link className="arrowlink" href={href(lang)}>{C[lang].home}</Link></p>
    </div></section>
  );
}
