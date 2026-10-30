import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { tt, type TKey } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "More" };
const ITEMS: [TKey, string][] = [["projects", "/team/projects"], ["sprints", "/team/sprints"], ["applications", "/team/applications"], ["relationships", "/team/relationships"], ["content", "/team/content"], ["newsletter", "/team/newsletter"], ["finance", "/team/finance"], ["settings", "/team/settings"], ["design", "/team/design"]];

/** Phone only: everything that isn't one of the four main tabs. */
export default async function More() {
  await requireMe();
  const { lang } = await teamPrefs();
  return <div className="card">{ITEMS.map(([k, href]) => <Link key={href} href={href} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><span>{tt(lang, k)}</span><span className="muted">{lang === "ar" ? "‹" : "›"}</span></Link>)}</div>;
}
