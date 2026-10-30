import Link from "next/link";
import { confirmSubscription } from "@/app/actions/public";
import { href, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };
const C = {
  ar: { ok: "تم تأكيد اشتراكك. بنكتب لك أول ما يكون فيه جديد.", bad: "الرابط ما يشتغل أو انتهى. اشترك من جديد من الصفحة الرئيسية.", home: "الرئيسية" },
  en: { ok: "Your subscription is confirmed. We'll write when there's news.", bad: "This link doesn't work or has expired. Subscribe again from the home page.", home: "Home" },
};

export default async function Confirm({ params, searchParams }: PageProps<"/[lang]/newsletter/confirm">) {
  const lang = (await params).lang as Lang;
  const tok = (await searchParams).t;
  const ok = typeof tok === "string" && (await confirmSubscription(tok));
  return (
    <section className="page on"><div className="wrap hero">
      <h1>{lang === "ar" ? "النشرة" : "Newsletter"}</h1>
      <p className="text muted" role="status">{ok ? C[lang].ok : C[lang].bad}</p>
      <p><Link className="arrowlink" href={href(lang)}>{C[lang].home}</Link></p>
    </div></section>
  );
}
