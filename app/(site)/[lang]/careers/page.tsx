import type { Metadata } from "next";
import careers from "@/content/careers.json";
import { CareerRole } from "@/components/site/CareerRole";
import { Scene } from "@/components/site/Scene";
import { t, type Lang } from "@/lib/i18n";
import { getOpenRoles, type OpenRole } from "@/lib/public-data";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;

// If the database can't be reached at build time, the roles from the prototype still render.
type J = { id: string; t: string[]; plain: string[]; pitch: string[]; do: string[][]; you: string[][] };
const fallback = (): OpenRole[] => (careers.roles as J[]).map((r) => ({
  id: r.id, slug: r.id, title_en: r.t[0], title_ar: r.t[1], plain_en: r.plain[0], plain_ar: r.plain[1], pitch_en: r.pitch[0], pitch_ar: r.pitch[1],
  do_en: r.do[0], do_ar: r.do[1], you_en: r.you[0], you_ar: r.you[1], form_schema: (careers.roleForms as Record<string, unknown[]>)[r.id],
}));

export async function generateMetadata({ params }: PageProps<"/[lang]/careers">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/careers", "nav_careers", t(lang, "car_lede"));
}

export default async function Careers({ params }: PageProps<"/[lang]/careers">) {
  const lang = (await params).lang as Lang;
  const roles = (await getOpenRoles()) ?? fallback();
  return (
    <section className="page on" data-page="careers">
      <div className="wrap hk-hero" style={{ textAlign: "start", justifyItems: "start" }}>
        <span className="eyebrow">{t(lang, "car_eb")}</span>
        <h1 style={{ color: "var(--fg)" }}>{t(lang, "car_h1")}</h1>
        <p style={{ maxWidth: "34rem" }}>{t(lang, "car_lede")}</p>
      </div>
      <div className="wrap">
        <div className="bar"><span className="eyebrow">{t(lang, "car_open")}</span><span className="eyebrow">{roles.length}</span></div>
        <div id="jobs-open">{roles.map((r) => <CareerRole key={r.slug} lang={lang} r={r} />)}</div>
      </div>
      <div className="scene-wrap" style={{ marginTop: "4rem" }}><Scene kind="dhow" style={{ height: "clamp(170px, 22vw, 280px)" }} /></div>
    </section>
  );
}
