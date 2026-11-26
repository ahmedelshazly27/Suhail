import type { Metadata } from "next";
import { t, type Lang } from "@/lib/i18n";
import { TRANSCRIPT, type Block } from "@/lib/manifesto";
import { pageMeta } from "@/lib/seo";

// The manifesto in the page's language (the header toggle switches), ending on the closing question over Suhail
// rising above the dunes.

const DESC = {
  ar: "بيان سهيل: كان في زمن، العالم كله يجي هنا عشان يتعلّم. لما يطلع سهيل هالمرة، إيش بنكون صنعنا؟",
  en: "The Suhail manifesto: there was a time when the whole world came here to learn. When Suhail rises this time, what will we have made?",
};
const L = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);

export async function generateMetadata({ params }: PageProps<"/[lang]/manifesto">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/manifesto", "nav_manifesto", DESC[lang], { url: "/media/manifesto/poster.jpg", width: 1920, height: 1080, alt: L(lang, "سهيل يطلع فوق الصحرا", "Suhail rising over the desert") });
}

/** "Suhail" in the accent ink wherever it appears, in either language. */
function Text({ s }: { s: string }) {
  return <>{s.split(/(سُهَيْل|سهيل|Suhail)/).map((part, i) => (i % 2 ? <span key={i} className="hl">{part}</span> : part))}</>;
}

function Words({ lang, blocks }: { lang: "ar" | "en"; blocks: Block[] }) {
  return (
    <div className={`mf-words mf-${lang}`}>
      {blocks.map((b, i) =>
        "quote" in b ? (
          <figure key={i} className={b.style === "cited" ? "mf-cited" : "mf-quote"}><blockquote><p>{b.quote}</p></blockquote><figcaption>{b.by}</figcaption></figure>
        ) : "lines" in b ? (
          <p key={i} className="mf-lines">{b.lines.map((l, j) => <span key={j}>{l}</span>)}</p>
        ) : (
          <p key={i} {...(b.last ? { id: "mf-q", className: "mf-last" } : {})}><Text s={b.p} /></p>
        ),
      )}
    </div>
  );
}

export default async function Manifesto({ params }: PageProps<"/[lang]/manifesto">) {
  const lang = (await params).lang as Lang;
  return (
    <section className="page on" data-page="manifesto">
      <div className="wrap hero" style={{ paddingBottom: "1rem" }}>
        <h1>{t(lang, "nav_manifesto")}</h1>
      </div>

      <div className="wrap mf-text">
        <Words lang={lang} blocks={TRANSCRIPT[lang]} />
      </div>
    </section>
  );
}
