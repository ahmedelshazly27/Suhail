"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { loadTicket } from "@/app/actions/read";
import { createTicket, updateTicket } from "@/app/actions/tickets";
import { saveView } from "@/app/actions/views";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/Status";
import { Peek } from "@/components/ui/Peek";
import { useToast } from "@/components/ui/Toast";
import { dueLabel } from "@/lib/dates";
import { PRIORITIES, STATUSES, tt, type Status, type TKey } from "@/lib/team-i18n";
import { Board, between, type Col } from "./Board";
import { TicketDetail, type Ctx } from "./TicketDetail";
import type { Ticket } from "@/lib/data/tickets";
import type { View } from "@/lib/data/views";

type Group = "status" | "assignee" | "priority";
type Props = { tickets: Ticket[]; ctx: Ctx; list: string; view: View; defaults?: { project_id?: string; sprint_id?: string }; swimlanes?: boolean; hideDone?: boolean; hideBacklog?: boolean };

export function TicketsView({ tickets, ctx, list, view, defaults, swimlanes, hideDone, hideBacklog }: Props) {
  const { lang, people, labels, projects } = ctx;
  const [layout, setLayout] = useState(view.layout);
  const [group, setGroup] = useState<Group>((view.group_by as Group) || "status");
  const [lanes, setLanes] = useState(Boolean(swimlanes));
  const [peek, setPeek] = useState<Awaited<ReturnType<typeof loadTicket>>>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const key = sp.get("t");

  const refreshPeek = useCallback(() => { if (key) loadTicket(key).then(setPeek); router.refresh(); }, [key, router]);
  useEffect(() => { if (key) loadTicket(key).then(setPeek); else setPeek(null); }, [key]);
  const open = (k: string) => router.push(`${path}?t=${k}`, { scroll: false });
  const close = useCallback(() => router.push(path, { scroll: false }), [router, path]);

  const person = (id: string | null) => people.find((p) => p.id === id);
  const label = (id: string) => labels.find((l) => l.id === id);
  const shown = hideDone ? tickets.filter((t) => t.status !== "cancelled") : tickets;

  const columns = useCallback((items: Ticket[]): Col<Ticket>[] => {
    if (group === "assignee") return [...people.map((p) => ({ id: p.id, title: p.name, items: items.filter((t) => t.assignee_id === p.id) })), { id: "none", title: tt(lang, "unassigned"), items: items.filter((t) => !t.assignee_id) }].filter((c) => c.items.length || c.id !== "none");
    if (group === "priority") return [...PRIORITIES].reverse().map((p) => ({ id: p, title: tt(lang, p), items: items.filter((t) => t.priority === p) }));
    const sts: Status[] = hideDone || hideBacklog ? ["todo", "in_progress", "in_review", "done"] : ["backlog", "todo", "in_progress", "in_review", "done"];
    return sts.map((s) => ({ id: s, title: tt(lang, s), dot: <StatusDot s={s} />, items: items.filter((t) => t.status === s) }));
  }, [group, people, lang, hideDone, hideBacklog]);

  const laneGroups = useMemo(() => (lanes ? [...projects.map((p) => ({ id: p.id, name: p.name })), { id: "", name: tt(lang, "noProject") }].map((p) => ({ ...p, items: shown.filter((t) => (t.project_id ?? "") === p.id) })).filter((g) => g.items.length) : [{ id: "all", name: "", items: shown }]), [lanes, projects, shown, lang]);

  const move = (id: string, col: string, _i: number, before: Ticket | null, after: Ticket | null) => start(async () => {
    const patch: Parameters<typeof updateTicket>[1] = { sort: between(before?.sort, after?.sort) };
    if (group === "status") patch.status = col as Status;
    if (group === "assignee") patch.assignee_id = col === "none" ? null : col;
    if (group === "priority") patch.priority = col as (typeof PRIORITIES)[number];
    await updateTicket(id, patch);
    router.refresh();
  });

  const card = (t: Ticket, dragging?: boolean) => {
    const d = dueLabel(lang, t.due_on), a = person(t.assignee_id), l = t.labels.map(label).filter(Boolean)[0];
    return (
      <button type="button" className={`bcard${dragging ? " dragging" : ""}`} aria-current={key === t.key} onClick={() => open(t.key)}>
        <span className="top"><span className="key">{t.key}</span>{t.estimate != null ? <span className="key">{t.estimate} {tt(lang, "pt")}</span> : null}</span>
        <span className="ttl">{t.flagged ? "⚑ " : ""}{t.title}</span>
        <span className="meta">{l ? <span className={`chip${l.attention ? " attn" : ""}`}>{l.name}</span> : null}<span className={`due ${d.cls}`}>{d.text}</span>{a ? <span className="av">{a.name.slice(0, 2).toUpperCase()}</span> : null}</span>
      </button>
    );
  };

  const addFooter = (laneProject: string | null) => (c: Col<Ticket>) => adding === c.id + laneProject ? (
    <form onSubmit={(e) => { e.preventDefault(); const title = String(new FormData(e.currentTarget).get("title") || "").trim(); if (!title) return; start(async () => {
      const r = await createTicket({ title, ...defaults, ...(laneProject ? { project_id: laneProject } : {}), ...(group === "status" ? { status: c.id as Status } : group === "assignee" && c.id !== "none" ? { assignee_id: c.id } : group === "priority" ? { priority: c.id as (typeof PRIORITIES)[number] } : {}) });
      setAdding(null); toast(r.key); router.refresh(); }); }}>
      <input name="title" className="inp" autoFocus placeholder={tt(lang, "titlePh")} aria-label={tt(lang, "titlePh")} onKeyDown={(e) => e.key === "Escape" && setAdding(null)} />
    </form>
  ) : <button type="button" className="addrow" onClick={() => setAdding(c.id + laneProject)}>+ {tt(lang, "addTicket")}</button>;

  return (
    <>
      <div className="tabs-u" style={{ borderBottom: 0, gap: ".5rem" }}>
        <div className="seg2" role="group" aria-label={lang === "ar" ? "العرض" : "Layout"}>
          {(["board", "table", "list"] as const).map((l) => <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}>{tt(lang, l)}</button>)}
        </div>
        <label className="muted" style={{ fontSize: ".78rem", display: "flex", gap: ".375rem", alignItems: "center" }}>{tt(lang, "group")}
          <select className="inp" style={{ width: "auto", padding: ".25rem .5rem" }} value={group} onChange={(e) => setGroup(e.target.value as Group)}>
            {(["status", "assignee", "priority"] as const).map((g) => <option key={g} value={g}>{tt(lang, g === "assignee" ? "assignee" : g)}</option>)}
          </select>
        </label>
        <label className="muted" style={{ fontSize: ".78rem", display: "flex", gap: ".375rem", alignItems: "center" }}><input type="checkbox" checked={lanes} onChange={(e) => setLanes(e.target.checked)} />{lang === "ar" ? "مسارات حسب المشروع" : "Swimlanes by project"}</label>
        <button type="button" className="linkbtn" style={{ marginInlineStart: "auto" }} onClick={() => start(async () => { await saveView({ list, layout, group_by: group, filters: {}, sort: [] }); toast(tt(lang, "viewSaved")); })}>{tt(lang, "saveView")}</button>
      </div>

      {laneGroups.map((g) => (
        <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
          {lanes ? <div className="lane-h">{g.name}</div> : null}
          {layout === "board" ? (
            <Board cols={columns(g.items)} render={card} onMove={move} footer={addFooter(lanes ? g.id || null : null)} label={g.name || tt(lang, "board")} />
          ) : layout === "table" ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>{lang === "ar" ? "الرقم" : "Key"}</th><th>{lang === "ar" ? "العنوان" : "Title"}</th><th>{tt(lang, "status")}</th><th>{tt(lang, "assignee")}</th><th>{tt(lang, "priority")}</th><th>{tt(lang, "due")}</th><th className="n">{tt(lang, "estimate")}</th></tr></thead>
              <tbody>{g.items.map((t) => { const d = dueLabel(lang, t.due_on); return (
                <tr key={t.id} onClick={() => open(t.key)} aria-selected={key === t.key} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(t.key)}>
                  <td className="key">{t.key}</td><td className="ell" style={{ maxWidth: "28rem" }}>{t.title}</td>
                  <td><span style={{ display: "inline-flex", gap: ".375rem", alignItems: "center" }}><StatusDot s={t.status} />{tt(lang, t.status as TKey)}</span></td>
                  <td>{person(t.assignee_id)?.name ?? ""}</td><td>{tt(lang, t.priority as TKey)}</td><td className={`due ${d.cls}`}>{d.text}</td><td className="n">{t.estimate ?? ""}</td>
                </tr>); })}</tbody>
            </table></div>
          ) : (
            <div className="card">{g.items.map((t) => { const d = dueLabel(lang, t.due_on); return (
              <button key={t.id} type="button" className="row row-work" onClick={() => open(t.key)} style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "start", cursor: "pointer" }}>
                <StatusDot s={t.status} /><span className="key">{t.key}</span><span className="ell">{t.title}</span>
                {person(t.assignee_id) ? <Avatar name={person(t.assignee_id)!.name} src={person(t.assignee_id)!.avatar_url} /> : <span />}<span className={`due ${d.cls}`}>{d.text}</span>
              </button>); })}</div>
          )}
        </div>
      ))}

      {peek ? (
        <Peek lang={lang} onClose={close} fullHref={`/team/tickets/${peek.ticket.key}`} crumb={<>{peek.ticket.key}{peek.project ? ` · ${peek.project.name}` : ""}</>}>
          <TicketDetail key={peek.ticket.id + peek.feed.length} data={peek} ctx={ctx} onChanged={refreshPeek} />
        </Peek>
      ) : null}
    </>
  );
}

export const STATUS_LIST = STATUSES;
