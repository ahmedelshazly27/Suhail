import type { Metadata } from "next";
import { Scene } from "@/components/site/Scene";
import { t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

const Hl = ({ children }: { children: React.ReactNode }) => <span className="hl">{children}</span>;
const AR = [
  <>كان في زمن، العالم كله يجي <Hl>هنا</Hl> عشان يتعلّم. بس في نصّ الطريق، ضيّعنا البوصلة.</>,
  <>خلّونا نرجع بالزمن شوي. الحضارة العربية والإسلامية كانت سابقة العالم في الطب، والرياضيات، والفلك، والكيمياء، والبصريات، والهندسة، والجغرافيا، والفلسفة.</>,
  <>في بغداد، بدأ علم الجبر بكتاب للخوارزمي. واسمه صار كلمة: خوارزمية. وكل جهاز في جيبك اليوم، يمشي عليها.</>,
  <>ولما كانت أوروبا تتعلّم الطب، كانت تتعلّمه من ابن سينا. ابن الهيثم فهم الضوء. الجزري خلّى الماء يشغّل الآلات. وابن ماجد قرا النجوم، وعبر فيها البحار. وفاطمة الفهرية أسّست في فاس أقدم جامعة باقية في العالم.</>,
  <>وكل صيف، إذا طلع <Hl>سهيل</Hl>، يعرف الناس إن الحرّ انكسر.</>,
  <>بس مع الوقت، بطّلنا نبني. وصرنا نشتري اللي يصنعه غيرنا. وأذكى شبابنا راحوا يبنون عند غيرنا، وكنّا نفرح لهم. وصار الطموح: شهادة، ووظيفة مضمونة، وراتب آخر الشهر. ورضينا بهذا.</>,
  <>اليوم، ثورة صناعية جديدة تنكتب قدّام عيوننا. والأدوات صارت بإيد أي واحد عنده فكرة. بس في فرق بين إنك تستخدم وإنك تصنع، وبين إنك تكون موجود وإنك تكون مؤثّر.</>,
  <>وإحنا كنّا مؤثّرين.</>,
  <>والناس اللي يرجّعون هذا التأثير، عندنا، من المحيط إلى الخليج، بس متفرّقين. وعشان هذا، بنجمعهم: اللي يبنون، واللي يموّلون، واللي يوظّفون، في مكان واحد. عشان العالم يرجع يجي هنا، يتعلّم.</>,
  <>والسؤال: لما يطلع <Hl>سهيل</Hl> هالمرة، إيش بنكون بنينا؟</>,
];
const EN = [
  <>There was a time when the whole world came <Hl>here</Hl> to learn. Somewhere along the way, we lost our compass.</>,
  <>Let&apos;s go back a little. Arab and Islamic civilisation led the world in medicine, mathematics, astronomy, chemistry, optics, engineering, geography and philosophy.</>,
  <>In Baghdad, algebra began with a book by al-Khwarizmi. His name became a word: algorithm. Every device in your pocket runs on it.</>,
  <>When Europe learned medicine, it learned it from Ibn Sina. Ibn al-Haytham understood light. Al-Jazari made water run machines. Ibn Majid read the stars and crossed the seas with them. And Fatima al-Fihri founded, in Fez, the oldest university in the world that still teaches.</>,
  <>Every summer, when <Hl>Suhail</Hl> rises, people know the heat has broken.</>,
  <>But over time, we stopped building. We started buying what others made. Our brightest went to build somewhere else, and we were happy for them. Ambition became a degree, a safe job and a salary at the end of the month. And we settled for it.</>,
  <>Today a new industrial revolution is being written in front of us, and the tools are in the hands of anyone with an idea. But there is a difference between using and making, and between being present and having influence.</>,
  <>We had influence once.</>,
  <>The people who can bring it back are here, from the Atlantic to the Gulf, but scattered. So we&apos;re bringing them together: the ones who build, the ones who fund and the ones who hire, in one place. So the world comes back here to learn.</>,
  <>The question is: when <Hl>Suhail</Hl> rises this time, what will we have built?</>,
];

export async function generateMetadata({ params }: PageProps<"/[lang]/manifesto">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/manifesto", "nav_manifesto", lang === "ar" ? "كان في زمن، العالم كله يجي هنا عشان يتعلّم." : "There was a time when the whole world came here to learn.");
}

export default async function Manifesto({ params }: PageProps<"/[lang]/manifesto">) {
  const lang = (await params).lang as Lang;
  return (
    <section className="page on" data-page="manifesto">
      <div className="wrap hero" style={{ paddingBottom: "2rem" }}><h1>{t(lang, "nav_manifesto")}</h1></div>
      <div className="wrap" style={{ paddingBottom: "6rem" }}>
        <div className="mtext">
          {(lang === "ar" ? AR : EN).map((p, i) => <p key={i}>{p}</p>)}
          <p className="sign">{lang === "ar" ? "أحمد الشاذلي، مؤسّس سهيل" : "Ahmed El Shazly, founder"}</p>
        </div>
      </div>
      <div className="scene-wrap"><Scene kind="astrolabe" style={{ height: "clamp(180px, 24vw, 300px)" }} /><span className="cap">{t(lang, "cap_astro")}</span></div>
    </section>
  );
}
