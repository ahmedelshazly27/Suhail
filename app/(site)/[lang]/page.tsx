import type { Metadata } from "next";
import { Scene } from "@/components/site/Scene";
import { Poster } from "@/components/site/Poster";
import { SoonBlock } from "@/components/site/Soon";
import { QuickSubscribe } from "@/components/site/forms/QuickSubscribe";
import { t, type Lang } from "@/lib/i18n";
import { getHackathons } from "@/lib/public-data";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;
const LEDE = {
  ar: "سهيل يجمع المؤسّسين والمهندسين والمستثمرين والمشغّلين عبر الهاكاثونات والفعاليات، ومجتمع يمتد من المحيط إلى الخليج.",
  en: "Suhail brings together founders, engineers, investors and operators through hackathons, events and a community that runs from the Atlantic to the Gulf.",
};
const PROGS = {
  ar: [["الهاكاثونات", "هاكاثونات أونلاين وحضورية في مدن المنطقة."], ["الفريج", "بيت يسكنه المؤسّسون ويبنون فيه موسمًا كاملًا."], ["الفرص", "وظائف مختارة في الشركات اللي تبني المنطقة."], ["موسم سهيل", "مؤتمر سنوي في أسبوع طلوع سهيل."], ["الشراكات", "للشركات والمستثمرين اللي يبون يوصلون للبُناة."], ["المجلس", "بودكاست مع ناس يبنون هنا."]],
  en: [["Hackathons", "Online and in-person hackathons across the region's cities."], ["Al Freej", "A house where founders live and build for a season."], ["Opportunities", "Hand-picked roles at the companies building the region."], ["Suhail Season", "A yearly conference in the week Suhail rises."], ["Partnerships", "For companies and investors who want to reach builders."], ["The Majlis", "A podcast with people building here."]],
};

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/", null, LEDE[lang]);
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = (await params).lang as Lang;
  const events = (await getHackathons()).slice(0, 3);
  return (
    <section className="page on" data-page="home">
      <div className="wrap hero">
        <h1>{lang === "ar" ? "منظومة واحدة للناس اللي يبنون مستقبل التقنية العربية." : "One ecosystem for the people building the future of Arab tech."}</h1>
        <p className="text muted">{LEDE[lang]}</p>
        <div id="subscribe">
          <p className="label" style={{ marginBottom: ".4rem" }}>{t(lang, "news_label")}</p>
          <QuickSubscribe lang={lang} source="home" variant="sub" label={t(lang, "subscribe")} />
        </div>
      </div>
      <div className="scene-wrap"><Scene kind="home" style={{ height: "clamp(220px, 34vw, 430px)" }} /><span className="cap">{t(lang, "cap_home")}</span></div>
      <div className="wrap sec">
        <div className="sec-head"><div className="row"><p className="label">{t(lang, "upcoming")}</p></div></div>
        <div className="evlist posters">{events.length ? events.map((e) => <Poster key={e.slug} lang={lang} e={e} />) : <SoonBlock lang={lang} />}</div>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <ul className="rows">
          {PROGS[lang].map(([n, d]) => (
            <li key={n}><div className="prog"><span className="n">{n} <em className="soontag">{t(lang, "soon")}</em></span><span className="d">{d}</span></div></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
