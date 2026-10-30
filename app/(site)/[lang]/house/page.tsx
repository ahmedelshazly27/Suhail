import type { Metadata } from "next";
import { Scene } from "@/components/site/Scene";
import { SoonBar } from "@/components/site/Soon";
import { StaticForm } from "@/components/site/StaticForm";
import { t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

const C = {
  ar: {
    h1: "اسكن في المكان اللي تبني فيه.",
    lede: "الفريج بيت حقيقي فيه حوش وطاولة طويلة وبرجيل. يسكنه مؤسّسون متفرّغين لموسم كامل، يصحون على نفس المشكلة اللي ناموا عليها، وحولهم ناس يفهمونهم.",
    day: [["07:00", "قهوة في الحوش", "كل واحد يقول وش بيسلّم اليوم."], ["09:00", "بناء", "مكاتب هادئة، وإنترنت قوي، وحوسبة جاهزة."], ["16:00", "زوّار", "مستثمر أو مؤسّس سبقك، يجي للبيت ويقعد معك."], ["21:00", "الطاولة الطويلة", "عشاء، ومراجعة اليوم، وأحيانًا عرض لشي انبنى."]],
    inhouse: ["غرفة لك", "مكتب", "رصيد حوسبة", "مستثمرون يزورونك", "عشاء كل ليلة", "ليلة عروض كل شهر"],
    who: ["متفرّغ لشركتك، أو مستعد تتفرّغ لما تدخل البيت.", "تبني شي تقني، وتقدر تورينا شي اشتغلت عليه.", "من أي مكان بين المحيط والخليج، أو راجع له."],
    how: ["قدّم. عشر دقايق، ورابط لشي بنيته.", "مكالمة قصيرة مع واحد من فريقنا.", "أسبوع تجربة في البيت.", "تنقل وتسكن معنا."],
  },
  en: {
    h1: "Live where you build.",
    lede: "Al Freej, named after the old Gulf neighbourhood where everyone knew each other, is a real house with a courtyard, a long table and a wind tower. Full-time founders live there for a season, wake up to the problem they slept on, and are surrounded by people who get it.",
    day: [["07:00", "Coffee in the courtyard", "Everyone says what they'll ship today."], ["09:00", "Build", "Quiet desks, fast internet, compute ready."], ["16:00", "Visitors", "An investor or a founder who's been there comes to sit with you."], ["21:00", "The long table", "Dinner, a review of the day, sometimes a demo of something new."]],
    inhouse: ["Your own room", "A desk", "Compute credits", "Investors who visit", "Dinner every night", "A demo night each month"],
    who: ["Full-time on your company, or ready to be when you move in.", "Building something technical, with something you can show us.", "From anywhere between the Atlantic and the Gulf, or coming back to it."],
    how: ["Apply. Ten minutes and a link to something you built.", "A short call with someone from our team.", "A trial week in the house.", "Move in."],
  },
};

export async function generateMetadata({ params }: PageProps<"/[lang]/house">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/house", "nav_house", C[lang].lede);
}

export default async function House({ params }: PageProps<"/[lang]/house">) {
  const lang = (await params).lang as Lang;
  const c = C[lang];
  return (
    <section className="page on" data-page="house">
      <SoonBar lang={lang} />
      <div className="wrap hero">
        <p className="label">{t(lang, "nav_house")}</p>
        <h1>{c.h1}</h1>
        <p className="text muted">{c.lede}</p>
      </div>
      <div className="scene-wrap"><Scene kind="house" style={{ height: "clamp(220px, 30vw, 380px)" }} /><span className="cap">{t(lang, "cap_house")}</span></div>
      <div className="wrap sec">
        <div className="sec-head"><p className="label">{t(lang, "house_day")}</p></div>
        <div className="day">{c.day.map(([k, h, p]) => <div key={k}><span className="k">{k}</span><h2 className="h3">{h}</h2><p className="muted">{p}</p></div>)}</div>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="sec-head"><p className="label">{t(lang, "house_in")}</p></div>
        <div className="inhouse">{c.inhouse.map((x) => <span key={x}>{x}</span>)}</div>
        <p className="muted text">{t(lang, "house_terms")}</p>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="sec-head"><p className="label">{t(lang, "house_who")}</p></div>
        <ul className="steps">{c.who.map((x) => <li key={x}><span className="k">·</span><p>{x}</p></li>)}</ul>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="sec-head"><p className="label">{t(lang, "house_how")}</p></div>
        <ol className="steps">{c.how.map((x, i) => <li key={x}><span className="k">{i + 1}</span><p>{x}</p></li>)}</ol>
      </div>
      <div className="wrap sec" style={{ paddingTop: 0 }}>
        <div className="formsec">
          <div className="sec-head"><h2>{t(lang, "house_form_h")}</h2><p className="muted">{t(lang, "house_form_p")}</p></div>
          <StaticForm k="house" lang={lang} />
        </div>
      </div>
    </section>
  );
}
