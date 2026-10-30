"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { assignApplications, emailApplicants, loadApplication, moveStage, tagApplications } from "@/app/actions/applications";
import { saveView } from "@/app/actions/views";
import { Avatar } from "@/components/ui/Avatar";
import { Peek } from "@/components/ui/Peek";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";
import { ApplicantDetail } from "./ApplicantDetail";
import { Board, type Col } from "./Board";
import type { AppRow, FormRow, RoleRow } from "@/lib/data/applications";
import type { Person } from "@/lib/data/shell";

type App = AppRow & { duplicate: boolean };
type Props = { lang: TLang; form: string; forms: FormRow[]; roles: RoleRow[]; apps: App[]; people: Person[]; templates: { key: string; name: string }[]; layout: "board" | "table" | "list" };
const age = (iso: string) => { const h = (Date.now() - Date.parse(iso)) / 36e5; return h < 24 ? `${Math.max(1, Math.round(h))} h` : h < 24 * 7 ? `${Math.round(h / 24)} d` : `${Math.round(h / 168)} w`; };
const dots = (s: number | null) => (s == null ? null : "●●●●●".slice(0, Math.round(s)) + "○○○○○".slice(0, 5 - Math.round(s)));

export function ApplicationsView({ lang, form, forms, roles, apps, people, templates, layout: initial }: Props) {
  const sp = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [layout, setLayout] = useState(initial);
  const [role, setRole] = useState<string>(sp.get("role") ?? "all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Awaited<ReturnType<typeof loadApplication>>>(null);
  const [, start] = useTransition();
  const id = sp.get("a");
  const f = forms.find((x) => x.key === form)!;
  const rows = useMemo(() => apps.filter((a) => role === "all" || a.role_id === role), [apps, role]);
  const roleOf = (a: App) => roles.find((r) => r.id === a.role_id);
  const reload = useCallback(() => { if (id) loadApplication(id).then(setPeek); router.refresh(); }, [id, router]);
  useEffect(() => { let alive = true; if (id) loadApplication(id).then((d) => { if (alive) setPeek(d); }); return () => { alive = false; }; }, [id]);
  const shown = id && peek?.app.id === id ? peek : null;
  const open = (aid: string) => { const q = new URLSearchParams(sp); q.set("a", aid); router.push(`${path}?${q}`, { scroll: false }); };
  const close = useCallback(() => { const q = new URLSearchParams(sp); q.delete("a"); router.push(`${path}?${q}`, { scroll: false }); }, [sp, path, router]);

  const cols: Col<App>[] = f.stages.filter((s) => s !== "Not now" || rows.some((a) => a.stage === s)).map((s) => ({ id: s, title: s, items: rows.filter((a) => a.stage === s) }));
  const card = (a: App, dragging?: boolean) => {
    const r = roleOf(a);
    return (
      <button type="button" className={`bcard${dragging ? " dragging" : ""}`} aria-current={id === a.id} onClick={() => open(a.id)}>
        <span style={{ display: "flex", gap: ".625rem", alignItems: "center" }}><Avatar name={a.name || a.email} size="md" /><span className="stack-t"><span style={{ fontWeight: 500 }}>{a.name || a.email}</span><span className="s">{String((a.answers as Record<string, string>).country ?? "")}</span></span></span>
        {r ? <span><span className={`chip${id === a.id ? " attn" : ""}`}>{lang === "ar" ? r.title_ar.split(" و")[0] : r.title_en.split(" and ")[0]}</span></span> : null}
        <span className="meta"><span className="key">{dots(a.score) ?? tt(lang, "notScored")}</span>{a.duplicate ? <span className="chip dashed" title={tt(lang, "duplicate")}>2×</span> : null}<span className="key" style={{ marginInlineStart: "auto" }}>{age(a.created_at)}</span></span>
      </button>
    );
  };
  const bulk = (fn: () => Promise<unknown>, msg: string) => start(async () => { await fn(); setSel(new Set()); toast(msg); router.refresh(); });
  const ids = [...sel];

  return (
    <>
      <nav className="tabs-u" aria-label={tt(lang, "applications")}>
        {forms.filter((x) => x.count || ["careers", "hack", "house"].includes(x.key)).sort((a, b) => (a.key === "careers" ? -1 : b.key === "careers" ? 1 : b.count - a.count)).map((x) => (
          <Link key={x.key} href={`/team/applications?form=${x.key}`} aria-current={x.key === form ? "page" : undefined}>{x.key === "careers" ? (lang === "ar" ? "أدوار الفريق" : "Team roles") : lang === "ar" ? x.name_ar : x.name_en} <span className="key">{x.count}</span></Link>
        ))}
        <span className="end"><a href={`/team-export?form=${form}`}>{tt(lang, "export")}</a></span>
      </nav>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
        {form === "careers" ? [{ id: "all", name: tt(lang, "allRoles"), n: apps.length }, ...roles.map((r) => ({ id: r.id, name: lang === "ar" ? r.title_ar.split(" و")[0] : r.title_en.split(" and ")[0], n: r.count }))].map((r) => (
          <button key={r.id} type="button" className="pill-s" aria-pressed={role === r.id} onClick={() => setRole(r.id)} style={{ fontSize: ".78rem", padding: ".3rem .7rem" }}>{r.name} <span className="key">{r.n}</span></button>
        )) : null}
        <div className="seg2" style={{ marginInlineStart: "auto" }} role="group" aria-label="Layout">
          {(["board", "table"] as const).map((l) => <button key={l} type="button" aria-pressed={layout === l} onClick={() => { setLayout(l); start(() => saveView({ list: `applications:${form}`, layout: l, group_by: "stage", filters: {}, sort: [] })); }}>{tt(lang, l)}</button>)}
        </div>
      </div>

      {layout === "board" ? (
        <Board cols={cols} render={card} label={tt(lang, "applications")} onMove={(aid, stage) => start(async () => { await moveStage({ ids: [aid], stage }); router.refresh(); })} />
      ) : (
        <>
          {sel.size ? (
            <div className="card soft" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", padding: ".625rem .875rem" }} role="toolbar" aria-label="Bulk actions">
              <span className="key">{sel.size} {tt(lang, "selected")}</span>
              <select className="inp" style={{ width: "auto" }} value="" aria-label={tt(lang, "moveTo")} onChange={(e) => e.target.value && bulk(() => moveStage({ ids, stage: e.target.value }), tt(lang, "saved"))}><option value="">{tt(lang, "moveTo")}…</option>{f.stages.map((s) => <option key={s}>{s}</option>)}</select>
              <select className="inp" style={{ width: "auto" }} value="" aria-label={tt(lang, "assign")} onChange={(e) => e.target.value && bulk(() => assignApplications({ ids, assignee: e.target.value }), tt(lang, "saved"))}><option value="">{tt(lang, "assign")}…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button type="button" className="b quiet" onClick={() => { const t = prompt(tt(lang, "tag")); if (t) bulk(() => tagApplications({ ids, tag: t }), tt(lang, "saved")); }}>{tt(lang, "tag")}</button>
              <select className="inp" style={{ width: "auto" }} value="" aria-label={tt(lang, "emailApplicant")} onChange={(e) => { const k = e.target.value; if (k && confirm(lang === "ar" ? `ترسل «${k}» إلى ${ids.length}؟` : `Send "${k}" to ${ids.length} applicant(s)?`)) bulk(() => emailApplicants({ ids, key: k }), tt(lang, "emailSent")); }}><option value="">{tt(lang, "emailApplicant")}…</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
            </div>
          ) : null}
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th className="chk"><input type="checkbox" aria-label="Select all" checked={sel.size > 0 && sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              <th>{tt(lang, "name")}</th>{form === "careers" ? <th>{tt(lang, "role")}</th> : null}<th>{tt(lang, "stage")}</th><th>{lang === "ar" ? "المراجع" : "Reviewer"}</th><th className="n">{tt(lang, "score")}</th><th>{tt(lang, "language2")}</th><th className="n">{tt(lang, "received")}</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} aria-selected={id === a.id} onClick={() => open(a.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(a.id)}>
                <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={a.name} checked={sel.has(a.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(a.id); else s.delete(a.id); setSel(s); }} /></td>
                <td><span style={{ display: "inline-flex", gap: ".5rem", alignItems: "center" }}>{a.name || a.email}{a.duplicate ? <span className="chip dashed">2×</span> : null}</span></td>
                {form === "careers" ? <td>{roleOf(a) ? (lang === "ar" ? roleOf(a)!.title_ar : roleOf(a)!.title_en) : ""}</td> : null}
                <td><span className={`chip${a.stage === "New" ? " attn" : ""}`}>{a.stage}</span></td>
                <td>{people.find((p) => p.id === a.assignee_id)?.name.split(" ")[0] ?? ""}</td>
                <td className="n">{a.score != null ? a.score.toFixed(1) : ""}</td><td>{a.lang.toUpperCase()}</td><td className="n">{age(a.created_at)}</td>
              </tr>))}</tbody>
          </table></div>
        </>
      )}
      {shown ? (
        <Peek lang={lang} onClose={close} fullHref={`/team/applications/${shown.app.id}`} crumb={shown.role ? `${lang === "ar" ? "أدوار الفريق" : "Team roles"} · ${lang === "ar" ? shown.role.title_ar : shown.role.title_en}` : lang === "ar" ? shown.form.name_ar : shown.form.name_en}>
          <ApplicantDetail key={shown.app.id + shown.feed.length + shown.app.stage} data={shown} lang={lang} people={people} templates={templates} onChanged={reload} />
        </Peek>
      ) : null}
    </>
  );
}
