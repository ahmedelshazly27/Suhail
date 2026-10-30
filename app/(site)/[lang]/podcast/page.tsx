import type { Metadata } from "next";
import { Scene } from "@/components/site/Scene";
import { SoonBar } from "@/components/site/Soon";
import { StaticForm } from "@/components/site/StaticForm";
import { t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

const EP = {
  ar: [["00 · البيان", "ليش سهيل، وليش الحين. قريبًا."], ["01 · الحلقة الأولى", "الضيف يُعلن للمشتركين. قيد التسجيل."]],
  en: [["00 · The manifesto", "Why Suhail, and why now. Soon."], ["01 · Episode one", "Guest announced to subscribers. Recording."]],
};

export async function generateMetadata({ params }: PageProps<"/[lang]/podcast">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/podcast", "nav_podcast", t(lang, "pod_lede"));
}

export default async function Podcast({ params }: PageProps<"/[lang]/podcast">) {
  const lang = (await params).lang as Lang;
  return (
    <section className="page on" data-page="podcast">
      <SoonBar lang={lang} />
      <div className="wrap hero"><h1>{t(lang, "nav_podcast")}</h1><p className="text muted">{t(lang, "pod_lede")}</p></div>
      <div className="scene-wrap"><Scene kind="dallah" style={{ height: "clamp(200px, 26vw, 340px)" }} /><span className="cap">{t(lang, "cap_dallah")}</span></div>
      <div className="wrap sec">
        <div className="sec-head"><p className="label">{t(lang, "episodes")}</p></div>
        <div>{EP[lang].map(([h, p]) => <div className="pair" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="formsec">
          <div className="sec-head"><h2>{t(lang, "pod_form_h")}</h2><p className="muted">{t(lang, "pod_form_p")}</p></div>
          <StaticForm k="podcast" lang={lang} />
        </div>
      </div>
    </section>
  );
}
