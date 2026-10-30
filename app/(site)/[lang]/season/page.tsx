import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import events from "@/content/events.json";
import { Scene } from "@/components/site/Scene";
import { SeasonStages } from "@/components/site/SeasonStages";
import { SoonBar } from "@/components/site/Soon";
import { Star } from "@/components/site/Star";
import { StaticForm } from "@/components/site/StaticForm";
import { QuickSubscribe } from "@/components/site/forms/QuickSubscribe";
import { href, t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/season">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/season", "nav_season", t(lang, "season_lede"));
}

export default async function Season({ params }: PageProps<"/[lang]/season">) {
  const lang = (await params).lang as Lang;
  const who = (events.who as string[][]).map((w) => w[lang === "ar" ? 1 : 0]);
  return (
    <section className="page on" data-page="season">
      <SoonBar lang={lang} />
      <div className="wrap cf-top"><span className="yr"><b>2027</b><i aria-hidden="true" /><span>2026</span></span><Link className="pill dark" href={href(lang, "/partners")}>{t(lang, "become_partner")}</Link></div>
      <div className="wrap cf-hero">
        <div className="cf-left">
          <h1>{t(lang, "season_h1")}</h1>
          <span className="dt">{t(lang, "season_dt")}</span>
          <p className="tl">{t(lang, "season_lede")}</p>
          <div><QuickSubscribe lang={lang} source="season" variant="pillform" label={t(lang, "updates")} /></div>
        </div>
        <div className="polaroids" aria-hidden="true">
          {/* Sizes follow .polaroids: each photo is 38% or 46% of the hero column, which is half the page above 860px. */}
          <figure className="p2"><Image src="/season/builders.jpg" alt="" width={720} height={480} sizes="(max-width: 860px) 38vw, 19vw" loading="eager" /></figure>
          <figure className="p3"><Image src="/season/capital.jpg" alt="" width={720} height={480} sizes="(max-width: 860px) 38vw, 19vw" loading="eager" /></figure>
          <figure className="p1"><Image src="/season/main.jpg" alt="" width={720} height={480} sizes="(max-width: 860px) 46vw, 23vw" preload /></figure>
          <figure className="p4"><div className="ascii"><Scene kind="rise" /><b>{t(lang, "season_short")}</b></div></figure>
        </div>
      </div>
      <div className="wrap strip">
        <span className="eyebrow">{t(lang, "whos_in")}</span>
        <div style={{ overflow: "hidden" }}><div className="marquee" aria-hidden="true">{[...who, ...who].map((w, i) => <span key={i}>{w}</span>)}</div><span className="vh-sr">{who.join(", ")}</span></div>
      </div>
      <div className="darkband" style={{ marginTop: "3.5rem" }}>
        <Scene kind="tent" style={{ height: "clamp(280px, 40vw, 520px)" }} />
        <div className="bandtxt"><span>{t(lang, "band_top")}</span><b>{t(lang, "season_short")}</b></div>
      </div>
      <div className="wrap sec" id="s-prog">
        <div className="bigtitle"><h2>{t(lang, "programme")}</h2><p>{t(lang, "programme_p")}</p></div>
        <SeasonStages lang={lang} />
      </div>
      <div className="wrap sec" id="s-speak" style={{ paddingTop: 0 }}>
        <div className="bigtitle"><h2>{t(lang, "speakers")}</h2><p>{t(lang, "speakers_p")}</p></div>
        <div className="spk">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}><span className="av"><Star /></span><div><b>{t(lang, "spk_tba")}</b><div className="rl">{t(lang, "spk_role")} · {t(lang, "brand")}</div><div className="tt">{t(lang, "spk_talk")}</div></div><span className="w">{lang === "ar" ? "قريبًا" : "SOON"}</span></div>
          ))}
        </div>
        <div style={{ paddingTop: "1.4rem" }}><a className="pill" href="#s-form">{t(lang, "apply_speak")}</a></div>
      </div>
      <div className="scene-wrap"><Scene kind="skyline" style={{ height: "clamp(160px, 22vw, 280px)" }} /></div>
      <div className="wrap" id="s-form" style={{ paddingBottom: "5rem" }}>
        <div className="updates formsec">
          <div style={{ display: "grid", gap: ".5rem" }}><h3>{t(lang, "cf_updates")}</h3><p className="muted">{t(lang, "cf_updates_p")}</p></div>
          <StaticForm k="season" lang={lang} />
        </div>
      </div>
    </section>
  );
}
