"use client";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { search, type Hit } from "@/app/actions/search";
import { createTicket } from "@/app/actions/tickets";
import { useToast } from "@/components/ui/Toast";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";
import type { ProjectLite } from "@/lib/data/shell";

const GO: [TKey, string, string][] = [["home", "/team", "G H"], ["inbox", "/team/inbox", "G I"], ["myWork", "/team/my-work", "G M"], ["projects", "/team/projects", "G P"],
  ["sprints", "/team/sprints", "G S"], ["applications", "/team/applications", "G A"], ["relationships", "/team/relationships", ""], ["content", "/team/content", ""],
  ["newsletter", "/team/newsletter", ""], ["drive", "/team/drive", ""], ["finance", "/team/finance", ""], ["settings", "/team/settings", ""], ["design", "/team/design", ""]];

/** Cmd+K anywhere; C anywhere (outside text fields) jumps straight to a new ticket; G then a letter navigates. */
export function Palette({ lang, projects }: { lang: TLang; projects: ProjectLite[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"find" | "new">("find");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [project, setProject] = useState<string>("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const g = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setMode("find"); setOpen((o) => !o); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); setMode("new"); setQ(""); setOpen(true); return; }
      if (e.key === "g") { g.current = Date.now(); return; }
      if (Date.now() - g.current < 900) {
        const to = { h: "/team", i: "/team/inbox", m: "/team/my-work", p: "/team/projects", s: "/team/sprints", a: "/team/applications" }[e.key];
        if (to) { e.preventDefault(); router.push(to); }
        g.current = 0;
      }
    };
    const onOpen = (e: Event) => { setMode((e as CustomEvent).detail === "new" ? "new" : "find"); setQ(""); setOpen(true); };
    addEventListener("keydown", onKey);
    addEventListener("suhail:palette", onOpen);
    return () => { removeEventListener("keydown", onKey); removeEventListener("suhail:palette", onOpen); };
  }, [router]);

  useEffect(() => {
    if (mode !== "find" || q.trim().length < 2) return;
    const id = setTimeout(() => start(async () => setHits(await search(q))), 160);
    return () => clearTimeout(id);
  }, [q, mode]);
  const shownHits = mode === "find" && q.trim().length >= 2 ? hits : [];

  if (!open) return null;
  const go = (href: string) => { setOpen(false); setQ(""); if (href.startsWith("http")) window.open(href, "_blank", "noopener"); else router.push(href); };
  const make = () => start(async () => {
    const title = q.trim();
    if (!title) return;
    const t = await createTicket({ title, project_id: project || null, status: "todo", assign_me: true });
    setOpen(false); setQ("");
    toast(`${t.key} ${tt(lang, "saved").toLowerCase()}`, { label: tt(lang, "open"), run: () => router.push(`/team/tickets/${t.key}`) });
  });
  const groups: Hit["group"][] = ["tickets", "applicants", "relationships", "projects", "files"];
  const gname: Record<Hit["group"], string> = { tickets: lang === "ar" ? "المهام" : "Tickets", applicants: tt(lang, "applications"), relationships: tt(lang, "relationships"), projects: tt(lang, "projects"), files: tt(lang, "files") };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <Command className="palette" label={tt(lang, "search")} 
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } }}>
        {mode === "new" ? (
          <form onSubmit={(e) => { e.preventDefault(); make(); }}>
            <input autoFocus cmdk-input="" placeholder={tt(lang, "titlePh")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tt(lang, "titlePh")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); make(); } }} />
            <div style={{ display: "flex", gap: ".5rem", padding: ".75rem 1.125rem", alignItems: "center" }}>
              <select className="inp" style={{ width: "auto" }} value={project} onChange={(e) => setProject(e.target.value)} aria-label={tt(lang, "project")}>
                <option value="">{tt(lang, "noProject")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="b" type="submit" disabled={pending || !q.trim()} style={{ marginInlineStart: "auto" }}>{tt(lang, "create")} <span className="k">↵</span></button>
            </div>
          </form>
        ) : (
          <>
            <Command.Input autoFocus value={q} onValueChange={setQ} placeholder={tt(lang, "search")} />
            <Command.List>
              <Command.Empty>{pending ? tt(lang, "loading") : tt(lang, "emptyList")}</Command.Empty>
              {groups.map((gr) => {
                const hs = shownHits.filter((h) => h.group === gr);
                return hs.length ? (
                  <Command.Group key={gr} heading={gname[gr]}>
                    {hs.map((h) => <Command.Item key={h.href} value={h.href + h.label} keywords={[q]} onSelect={() => go(h.href)}><span className="tag">{h.tag}</span><span className="ell">{h.label}</span><span className="meta">{h.meta}</span></Command.Item>)}
                  </Command.Group>
                ) : null;
              })}
              <Command.Group heading={lang === "ar" ? "إجراءات" : "Actions"}>
                {GO.map(([k, href, kb]) => <Command.Item key={href} value={tt(lang, k) + " " + k} onSelect={() => go(href)}><span className="tag">{lang === "ar" ? "انتقل" : "Go"}</span>{tt(lang, k)}<span className="meta mono">{kb}</span></Command.Item>)}
                <Command.Item value={"new ticket " + q} onSelect={() => setMode("new")}><span className="tag">{lang === "ar" ? "جديد" : "New"}</span>{tt(lang, "newTicket")}{q ? ` "${q}"` : ""}<span className="meta mono">C</span></Command.Item>
              </Command.Group>
            </Command.List>
          </>
        )}
        <div className="palette-f"><span>↑↓</span><span>↵ {tt(lang, "open").toLowerCase()}</span><span>esc {tt(lang, "close").toLowerCase()}</span><span style={{ marginInlineStart: "auto" }}>C {tt(lang, "newTicket").toLowerCase()}</span></div>
      </Command>
    </div>
  );
}

export const openPalette = (mode: "find" | "new" = "find") => dispatchEvent(new CustomEvent("suhail:palette", { detail: mode }));
