import Link from "next/link";
import { href, t, type Lang } from "@/lib/i18n";
import type { Hackathon } from "@/lib/public-data";
import { Scene, type SceneKind } from "./Scene";
import { Star } from "./Star";

export const evWhen = (lang: Lang, e: Hackathon) => (lang === "ar" ? "التاريخ يُعلن" : "Date TBA") + " · " + (lang === "ar" ? e.city_ar : e.city_en);

export function Poster({ lang, e }: { lang: Lang; e: Hackathon }) {
  const title = lang === "ar" ? e.title_ar : e.title_en;
  return (
    <Link className="poster" href={href(lang, `/hackathons/${e.slug}`)}>
      <div className="art">
        <Scene kind={e.scene as SceneKind} />
        <span className="mark"><Star /><span>{t(lang, "brand")}</span></span>
        <div className="ov"><b>{title}</b><span>{(lang === "ar" ? "قريبًا" : "TBA") + " | " + (lang === "ar" ? e.city_ar : e.city_en)}</span></div>
      </div>
      <div className="meta2">
        <span className="t">{t(lang, "brand")} · {title}</span>
        <span className="d">{evWhen(lang, e)}</span>
        <span className="go">{t(lang, "view_apply")}</span>
      </div>
    </Link>
  );
}
