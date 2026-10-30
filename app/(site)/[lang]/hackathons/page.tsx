import type { Metadata } from "next";
import { Poster } from "@/components/site/Poster";
import { Scene } from "@/components/site/Scene";
import { SoonBar, SoonBlock } from "@/components/site/Soon";
import { evCount, t, type Lang } from "@/lib/i18n";
import { getHackathons } from "@/lib/public-data";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/hackathons">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/hackathons", "nav_hack", t(lang, "hack_lede"));
}

export default async function Hackathons({ params }: PageProps<"/[lang]/hackathons">) {
  const lang = (await params).lang as Lang;
  const events = await getHackathons();
  return (
    <section className="page on" data-page="hackathons">
      <SoonBar lang={lang} />
      <div className="wrap hk-hero"><h1>{t(lang, "nav_hack")}</h1><p>{t(lang, "hack_lede")}</p></div>
      <div className="wrap">
        <div className="bar"><span className="eyebrow">{t(lang, "hack_up")}</span><span className="eyebrow">{events.length ? evCount(lang, events.length) : ""}</span></div>
        <div className="posters">{events.length ? events.map((e) => <Poster key={e.slug} lang={lang} e={e} />) : <SoonBlock lang={lang} />}</div>
      </div>
      <div className="wrap sec">
        <div className="past-head"><div style={{ display: "grid", gap: ".6rem" }}><span className="eyebrow">{t(lang, "prev_at")}</span><h2>{t(lang, "hack_past")}</h2></div><p className="muted" style={{ fontSize: ".92rem" }}>{t(lang, "hack_past_p")}</p></div>
        <div className="pastrow">
          <div className="thumb">{"–"}</div>
          <div style={{ display: "grid", gap: ".35rem" }}><span className="d">{t(lang, "past_d")}</span><span className="t">{t(lang, "past_t")}</span><span className="muted" style={{ fontSize: ".85rem" }}>{t(lang, "past_c")}</span></div>
          <div className="r"><span>{t(lang, "projects")}</span><span>{t(lang, "winner")}</span></div>
        </div>
      </div>
      <div className="scene-wrap"><Scene kind="pattern" style={{ height: "clamp(150px, 20vw, 240px)" }} /><span className="cap">{t(lang, "cap_pattern")}</span></div>
    </section>
  );
}
