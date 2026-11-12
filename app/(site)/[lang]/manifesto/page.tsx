import type { Metadata } from "next";
import Link from "next/link";
import { Scene } from "@/components/site/Scene";
import { QuickSubscribe } from "@/components/site/forms/QuickSubscribe";
import { href, t, type Lang } from "@/lib/i18n";
import { CLOSING, FILM_LENGTH, FILM_URL, TRANSCRIPT, type Block } from "@/lib/manifesto";
import { pageMeta } from "@/lib/seo";

// The manifesto: the film first, then its words as a text (Arabic first, then English, whatever the page language),
// and the closing question over Suhail rising above the dunes.

const DESC = {
  ar: "فيلم سهيل: كان في زمن، العالم كله يجي هنا عشان يتعلّم. لما يطلع سهيل هالمرة، إيش بنكون صنعنا؟",
  en: "The Suhail film: there was a time when the whole world came here to learn. When Suhail rises this time, what will we have made?",
};
const L = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);

export async function generateMetadata({ params }: PageProps<"/[lang]/manifesto">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/manifesto", "nav_manifesto", DESC[lang], { url: "/media/manifesto/poster.jpg", width: 1920, height: 1080, alt: L(lang, "لقطة من فيلم بيان سهيل", "A still from the Suhail manifesto film") });
}

/** "Suhail" in the accent ink wherever it appears, in either language. */
function Text({ s }: { s: string }) {
  return <>{s.split(/(سُهَيْل|سهيل|Suhail)/).map((part, i) => (i % 2 ? <span key={i} className="hl">{part}</span> : part))}</>;
}

function Words({ lang, blocks }: { lang: "ar" | "en"; blocks: Block[] }) {
  return (
    <section className={`mf-words mf-${lang}`} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} aria-labelledby={`mf-h-${lang}`}>
      <h2 id={`mf-h-${lang}`} className="label">{lang === "ar" ? "النص بالعربي" : "The words in English"}</h2>
      {blocks.map((b, i) =>
        "quote" in b ? (
          <figure key={i} className="mf-quote"><blockquote><p>{b.quote}</p></blockquote><figcaption>{b.by}</figcaption></figure>
        ) : "lines" in b ? (
          <p key={i} className="mf-lines">{b.lines.map((l, j) => <span key={j}>{l}</span>)}</p>
        ) : (
          <p key={i}><Text s={b.p} /></p>
        ),
      )}
    </section>
  );
}

export default async function Manifesto({ params }: PageProps<"/[lang]/manifesto">) {
  const lang = (await params).lang as Lang;
  const other = lang === "ar" ? "en" : "ar";
  return (
    <section className="page on" data-page="manifesto">
      <div className="wrap hero" style={{ paddingBottom: "1.5rem" }}>
        <h1>{t(lang, "nav_manifesto")}</h1>
        <p className="text muted">{L(lang, `فيلم، ${FILM_LENGTH} دقيقة. النص كامل تحت.`, `A film, ${FILM_LENGTH}. The full text is below.`)}</p>
      </div>

      <div className="wrap">
        <figure className="mf-film">
          <video controls playsInline preload="metadata" poster="/media/manifesto/poster.jpg" aria-label={L(lang, "فيلم بيان سهيل", "The Suhail manifesto film")}>
            <source src={FILM_URL} type="video/mp4" />
            <track kind="captions" src="/media/manifesto/manifesto.ar.vtt" srcLang="ar" label="العربية" default={lang === "ar"} />
            <track kind="captions" src="/media/manifesto/manifesto.en.vtt" srcLang="en" label="English" default={lang === "en"} />
            <a href={FILM_URL}>{L(lang, "حمّل الفيلم", "Download the film")}</a>
          </video>
          <figcaption className="cap">{L(lang, "اللقطة الافتتاحية: C-SPAN / Spectrum News.", "Opening clip: C-SPAN / Spectrum News.")}</figcaption>
        </figure>
      </div>

      <div className="wrap mf-text">
        <Words lang="ar" blocks={TRANSCRIPT.ar} />
        <Words lang="en" blocks={TRANSCRIPT.en} />
      </div>

      <section className="darkband mf-close" aria-labelledby="mf-q">
        <Scene kind="dunes" className="scene mf-scene" />
        <div className="wrap mf-close-in">
          <p className="mf-lead">{CLOSING[lang].lead}</p>
          <h2 id="mf-q" className="mf-q"><Text s={CLOSING[lang].q} /></h2>
          <p className="mf-q-other" lang={other} dir={other === "ar" ? "rtl" : "ltr"}><Text s={CLOSING[other].q} /></p>
          <div className="mf-act">
            <div className="mf-sub">
              <p className="label">{t(lang, "news_label")}</p>
              <QuickSubscribe lang={lang} source="manifesto" variant="sub" label={t(lang, "subscribe")} />
            </div>
            <Link className="btn mf-join" href={href(lang, "/careers")}>{L(lang, "انضم لنا", "Join us")}</Link>
          </div>
        </div>
      </section>
    </section>
  );
}
