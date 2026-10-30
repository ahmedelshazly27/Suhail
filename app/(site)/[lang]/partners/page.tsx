import type { Metadata } from "next";
import { Scene } from "@/components/site/Scene";
import { SoonBar } from "@/components/site/Soon";
import { StaticForm } from "@/components/site/StaticForm";
import { t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

const AREAS = {
  ar: [["01", "المواهب", "وظّف مهندسين ومؤسّسين تقنيين.", ["مسار شريك في الهاكاثون", "التوظيف", "لوحة الفرص", "قسم الوظائف في النشرة"]],
    ["02", "الانتشار", "حط منتجك بإيد البُناة.", ["شريك تقني في الهاكاثون", "استضافة هاكاثون مشترك", "شريك تقني للفريج", "موسم سهيل", "ظهور في النشرة"]],
    ["03", "المجتمع", "ابنِ علاقات مع المؤسّسين والمهندسين.", ["استضافة فعالية", "شراكة مجتمعية", "رعاية النشرة", "عشاوات وفعاليات خاصة", "شريك علامة في موسم سهيل"]]],
  en: [["01", "Talent", "Hire engineers and technical founders.", ["Hackathon track partner", "Recruiting", "Opportunities board", "Newsletter roles section"]],
    ["02", "Distribution", "Put your product in builders' hands.", ["Hackathon technology partner", "Hackathon co-host", "Al Freej technology partner", "Suhail Season", "Newsletter placement"]],
    ["03", "Community", "Build relationships with founders and engineers.", ["Host an event", "Community partnership", "Newsletter sponsorship", "Dinners and custom events", "Suhail Season brand partner"]]],
} as const;
const HOW = {
  ar: ["قل لنا وش تبي: توظيف، أو استخدام، أو انتشار.", "نختار الصيغة: هاكاثون، أو توظيف، أو النشرة، أو فعالية.", "ننفّذها معك من البداية للنهاية."],
  en: ["Tell us what you're after: hiring, usage or reach.", "We pick the format: a hackathon, recruiting, the newsletter or an event.", "We run it with you, end to end."],
};

export async function generateMetadata({ params }: PageProps<"/[lang]/partners">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/partners", "nav_partners", t(lang, "partners_lede"));
}

export default async function Partners({ params }: PageProps<"/[lang]/partners">) {
  const lang = (await params).lang as Lang;
  return (
    <section className="page on" data-page="partners">
      <SoonBar lang={lang} />
      <div className="wrap hero">
        <h1>{t(lang, "partners_h1")}</h1>
        <p className="text muted">{t(lang, "partners_lede")}</p>
        <div className="actions" style={{ gap: "1.5rem" }}><a className="btn" href="#form-partner">{t(lang, "build_together")}</a></div>
      </div>
      <div className="scene-wrap"><Scene kind="dhow" style={{ height: "clamp(200px, 28vw, 360px)" }} /><span className="cap">{t(lang, "cap_dhow")}</span></div>
      <div className="wrap sec">
        <div className="sec-head"><p className="label">{t(lang, "here_for")}</p></div>
        <div className="areas">
          {AREAS[lang].map(([k, h, p, li]) => <div key={k}><span className="k">{k}</span><h2>{h}</h2><p className="muted">{p}</p><ul>{li.map((x) => <li key={x}>{x}</li>)}</ul></div>)}
        </div>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="sec-head"><p className="label">{t(lang, "how")}</p></div>
        <ol className="steps">{HOW[lang].map((x, i) => <li key={x}><span className="k">{i + 1}</span><p>{x}</p></li>)}</ol>
      </div>
      <div className="wrap sec" id="form-partner" style={{ paddingTop: 0 }}>
        <div className="formsec"><div className="sec-head"><h2>{t(lang, "find_format")}</h2></div><StaticForm k="partner" lang={lang} /></div>
      </div>
    </section>
  );
}
