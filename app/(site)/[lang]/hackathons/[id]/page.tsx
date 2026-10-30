import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import events from "@/content/events.json";
import { evWhen } from "@/components/site/Poster";
import { SoonBar } from "@/components/site/Soon";
import { StaticForm } from "@/components/site/StaticForm";
import { href, t, type Lang } from "@/lib/i18n";
import { getHackathons } from "@/lib/public-data";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;
const find = async (id: string) => (await getHackathons()).find((e) => e.slug === id);

export async function generateMetadata({ params }: PageProps<"/[lang]/hackathons/[id]">): Promise<Metadata> {
  const { lang, id } = (await params) as { lang: Lang; id: string };
  const e = await find(id);
  return e ? pageMeta(lang, `/hackathons/${id}`, "nav_hack", lang === "ar" ? e.desc_ar : e.desc_en) : {};
}

export default async function Event({ params }: PageProps<"/[lang]/hackathons/[id]">) {
  const { lang, id } = (await params) as { lang: Lang; id: string };
  const all = await getHackathons();
  const e = all.find((x) => x.slug === id);
  if (!e) notFound();
  const ar = lang === "ar";
  const opts = all.map((x) => [x.slug, `${x.title_en} · ${x.city_en}`, `${x.title_ar} · ${x.city_ar}`] as [string, string, string]);
  return (
    <section className="page on" data-page="event">
      <SoonBar lang={lang} />
      <div className="wrap evp">
        <Link className="back" href={href(lang, "/hackathons")}>{t(lang, "all_hacks")}</Link>
        <div><span className="tag">{t(lang, e.fmt)}</span></div>
        <div className="top2">
          <div style={{ display: "grid", gap: ".7rem", minWidth: 0 }}><h1>{t(lang, "brand")} · {ar ? e.title_ar : e.title_en}</h1><span className="when">{evWhen(lang, e)}</span></div>
          <a className="pill dark" href="#ev-apply" style={{ padding: ".95rem 1.4rem" }}>{t(lang, "join_hack")}</a>
        </div>
        <p className="quote">{ar ? e.desc_ar : e.desc_en}</p>
        <hr className="dash" />
        <div className="h2row"><h2>{t(lang, "agenda")}</h2><span className="muted" style={{ fontSize: ".78rem" }}>{t(lang, "agenda_note")}</span></div>
        <div className="agenda">
          {(events.agenda as (string | number)[][]).map((r) => (
            <div key={String(r[0])}><b>{r[0]}</b><span>{ar ? r[2] : r[1]}{r[3] ? <span className="dl">{t(lang, "deadline")}</span> : null}</span></div>
          ))}
        </div>
        <hr className="dash" />
        <div id="ev-apply" style={{ display: "grid", gap: "1.2rem" }}>
          <div className="h2row"><h2>{t(lang, "hack_form_h")}</h2></div>
          <p className="muted">{t(lang, "hack_form_p")}</p>
          <StaticForm k="hack" lang={lang} hackathons={opts} preset={{ event: e.slug }} />
        </div>
      </div>
    </section>
  );
}
