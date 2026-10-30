"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { openPalette } from "./Palette";
import { Brand } from "./Mark";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";
import type { ProjectLite } from "@/lib/data/shell";

type Props = { lang: TLang; me: { name: string; avatar_url: string | null; team_role: string }; counts: Record<string, number>; projects: ProjectLite[]; m365: boolean };
const TOP: [TKey, string, string?][] = [["home", "/team"], ["inbox", "/team/inbox", "inbox"], ["myWork", "/team/my-work"]];
const WORK: [TKey, string, string?][] = [["projects", "/team/projects", "projects"], ["sprints", "/team/sprints"], ["applications", "/team/applications", "applications"],
  ["relationships", "/team/relationships"], ["content", "/team/content"], ["newsletter", "/team/newsletter"], ["drive", "/team/drive"], ["finance", "/team/finance", "finance"]];
const DOTS = ["var(--st-review)", "var(--st-done)", "var(--muted)"];

export function Sidebar({ lang, me, counts, projects, m365 }: Props) {
  const path = usePathname();
  const cur = (href: string) => (href === "/team" ? path === "/team" : path === href || path.startsWith(href + "/"));
  const item = ([k, href, c]: [TKey, string, string?]) => (
    <Link key={href} href={href} className="side-item" aria-current={cur(href) ? "page" : undefined}>
      <span>{tt(lang, k)}</span>{c && counts[c] ? <span className="n">{counts[c]}</span> : null}
    </Link>
  );
  return (
    <nav className="side" aria-label={lang === "ar" ? "لوحة الفريق" : "Dashboard"}>
      <div className="side-top">
        <Link href="/team" style={{ textDecoration: "none" }}><Brand lang={lang} /></Link>
        <button type="button" className="kbd" onClick={() => openPalette()}>⌘K<span className="vh-sr"> {tt(lang, "search")}</span></button>
      </div>
      <div className="side-group">{TOP.map(item)}</div>
      <div className="side-group"><span className="side-label">{tt(lang, "workspace")}</span>{WORK.map(item)}</div>
      {projects.length ? (
        <div className="side-group">
          <span className="side-label">{tt(lang, "projects")}</span>
          {projects.slice(0, 8).map((p, i) => (
            <Link key={p.id} href={`/team/projects/${p.slug}`} className="side-item" aria-current={cur(`/team/projects/${p.slug}`) ? "page" : undefined}>
              <span className="side-proj"><span className="dot" style={{ background: i === 0 ? "var(--st-progress)" : DOTS[(i - 1) % DOTS.length] }} />{p.name}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="side-dither dither dither-up" aria-hidden="true" />
      <div style={{ display: "flex", flexDirection: "column", gap: ".625rem" }}>
        <Link href="/team/settings/microsoft" className="side-m365" style={{ textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h10v10H4z" /><path d="M14 10l6-3v10l-6-3" /></svg>
          <span>{tt(lang, m365 ? "m365on" : "m365off")}</span><span className={m365 ? "on" : "off"} />
        </Link>
        <Link href="/team/settings" className="side-me">
          <Avatar name={me.name} src={me.avatar_url} size="lg" ink me />
          <span className="nm"><b>{me.name.split(" ")[0]}</b><span>{tt(lang, me.team_role === "owner" ? "owner" : me.team_role === "admin" ? "admin" : "member")} · {tt(lang, "available")}</span></span>
          <span className="st">{tt(lang, "settings")}</span>
        </Link>
      </div>
    </nav>
  );
}
