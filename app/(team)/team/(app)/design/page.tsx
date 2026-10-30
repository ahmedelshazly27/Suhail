import { Specimen } from "@/components/team/Specimen";
import { requireMe } from "@/lib/auth";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Design system" };

/** Every token and primitive, side by side in light and dark, Arabic and English. Review UI changes here. */
export default async function Design() {
  await requireMe();
  const { lang } = await teamPrefs();
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">design-system/</span><h1>{lang === "ar" ? "نظام التصميم" : "Design system"}</h1></div></header>
      <div className="grid-2" style={{ alignItems: "start" }}>
        {(["light", "dark"] as const).flatMap((theme) => (["en", "ar"] as const).map((l) => (
          <div key={theme + l} data-theme={theme} lang={l} dir={l === "ar" ? "rtl" : "ltr"} className="spec-frame"><Specimen lang={l} theme={theme} /></div>
        )))}
      </div>
    </>
  );
}
