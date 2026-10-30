"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteTicket, updateTicket } from "@/app/actions/tickets";
import { StatusDot } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toast";
import { dueLabel } from "@/lib/dates";
import { PRIORITIES, STATUSES, tt, type TLang } from "@/lib/team-i18n";
import { Editor, type Doc } from "./Editor";
import { Feed } from "./Feed";
import type { getTicket, Label, Sprint } from "@/lib/data/tickets";
import type { Person, ProjectLite } from "@/lib/data/shell";

type Data = NonNullable<Awaited<ReturnType<typeof getTicket>>>;
export type Ctx = { lang: TLang; people: Person[]; projects: ProjectLite[]; sprints: Sprint[]; labels: Label[] };

export function TicketDetail({ data, ctx, onChanged }: { data: Data; ctx: Ctx; onChanged?: () => void }) {
  const { lang, people, projects, sprints, labels } = ctx;
  const t = data.ticket;
  const [title, setTitle] = useState(t.title);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const save = (patch: Parameters<typeof updateTicket>[1]) => start(async () => { await updateTicket(t.id, patch); if (onChanged) onChanged(); else router.refresh(); });
  const descTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const due = dueLabel(lang, t.due_on);
  const sprint = sprints.find((s) => s.id === t.sprint_id);
  return (
    <>
      <textarea className="inline-title" rows={2} value={title} aria-label={tt(lang, "titlePh")} onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== t.title && save({ title: title.trim() })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />
      <dl className="props">
        <dt>{tt(lang, "status")}</dt>
        <dd><StatusDot s={t.status} /><select aria-label={tt(lang, "status")} value={t.status} onChange={(e) => save({ status: e.target.value as typeof STATUSES[number] })}>{STATUSES.map((s) => <option key={s} value={s}>{tt(lang, s)}</option>)}</select></dd>
        <dt>{tt(lang, "assignee")}</dt>
        <dd><select aria-label={tt(lang, "assignee")} value={t.assignee_id ?? ""} onChange={(e) => save({ assignee_id: e.target.value || null })}><option value="">{tt(lang, "unassigned")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></dd>
        <dt>{tt(lang, "due")}</dt>
        <dd><span className="datewrap"><input type="date" aria-label={tt(lang, "due")} value={t.due_on ?? ""} onChange={(e) => save({ due_on: e.target.value || null })} /><span className={due.cls === "late" || due.cls === "today" ? `due ${due.cls}` : ""} style={{ fontSize: ".84375rem" }}>{due.text || (lang === "ar" ? "بدون موعد" : "No date")}</span></span></dd>
        <dt>{tt(lang, "priority")}</dt>
        <dd><select aria-label={tt(lang, "priority")} value={t.priority} onChange={(e) => save({ priority: e.target.value as typeof PRIORITIES[number] })}>{PRIORITIES.map((p) => <option key={p} value={p}>{tt(lang, p)}</option>)}</select></dd>
        <dt>{tt(lang, "sprint")}</dt>
        <dd><select aria-label={tt(lang, "sprint")} value={t.sprint_id ?? ""} onChange={(e) => save({ sprint_id: e.target.value || null })}><option value="">{tt(lang, "noSprintOpt")}</option>{sprints.filter((s) => s.status !== "done" || s.id === t.sprint_id).map((s) => <option key={s.id} value={s.id}>{tt(lang, "sprint")} {s.number}</option>)}</select>
          <span className="muted">·</span><input className="est" type="number" min={0} max={100} aria-label={tt(lang, "estimate")} value={t.estimate ?? ""} onChange={(e) => save({ estimate: e.target.value === "" ? null : Number(e.target.value) })} /><span className="muted">{tt(lang, "points")}</span>{sprint ? null : null}</dd>
        <dt>{tt(lang, "project")}</dt>
        <dd><select aria-label={tt(lang, "project")} value={t.project_id ?? ""} onChange={(e) => save({ project_id: e.target.value || null })}><option value="">{tt(lang, "noProject")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></dd>
        <dt>{tt(lang, "labels")}</dt>
        <dd style={{ flexWrap: "wrap" }}>
          {t.labels.map((id) => labels.find((l) => l.id === id)).filter(Boolean).map((l) => (
            <button key={l!.id} type="button" className={`chip chip-btn${l!.attention ? " attn" : ""}`} title={lang === "ar" ? "اضغط للإزالة" : "Click to remove"} onClick={() => save({ labels: t.labels.filter((x) => x !== l!.id) })}>{l!.name}</button>
          ))}
          <select className="chip-add" aria-label={lang === "ar" ? "أضف وسم" : "Add label"} value="" onChange={(e) => e.target.value && save({ labels: [...t.labels, e.target.value] })}>
            <option value="">+ {lang === "ar" ? "وسم" : "Label"}</option>
            {labels.filter((l) => !t.labels.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </dd>
        {data.parent || data.mails.length ? <><dt>{tt(lang, "linked")}</dt><dd style={{ flexWrap: "wrap" }}>
          {data.parent ? <Link href={`/team/tickets/${data.parent.key}`}>{data.parent.key} {data.parent.title}</Link> : null}
          {data.mails.map((m) => <a key={m.id} href={m.web_link || "#"} target="_blank" rel="noreferrer">{lang === "ar" ? "إيميل" : "Email"}: {m.subject}</a>)}
        </dd></> : null}
      </dl>
      <Editor value={t.description as Doc} people={people} placeholder={lang === "ar" ? "أضف وصف، أو / للأوامر" : "Add a description, or / for commands"} label={lang === "ar" ? "الوصف" : "Description"}
        onChange={(d) => { clearTimeout(descTimer.current); descTimer.current = setTimeout(() => updateTicket(t.id, { description: d as { type: "doc" } }), 700); }} />
      {data.files.map((f) => (
        <a key={f.id} href={f.web_url} target="_blank" rel="noreferrer" className="card" style={{ display: "flex", gap: ".75rem", alignItems: "center", padding: ".75rem .875rem", textDecoration: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></svg>
          <span className="stack-t"><span>{f.name}</span><span className="s">SharePoint</span></span>
        </a>
      ))}
      {data.subs.length ? (
        <div><div className="sect-h">{tt(lang, "subTickets")}</div>
          {data.subs.map((s) => <Link key={s.id} href={`/team/tickets/${s.key}`} style={{ display: "flex", gap: ".5rem", alignItems: "center", padding: ".375rem 0", textDecoration: "none" }}><StatusDot s={s.status} /><span className="key">{s.key}</span>{s.title}</Link>)}
        </div>
      ) : null}
      <div className="sect-h">{tt(lang, "commentsActivity")}</div>
      <Feed lang={lang} items={data.feed} people={people} entity={{ type: "ticket", id: t.id }} onPosted={onChanged} />
      <div><button type="button" className="b danger" onClick={() => start(async () => { await deleteTicket(t.id); toast(tt(lang, "deleted"), { label: tt(lang, "undo"), run: () => deleteTicket(t.id, true).then(() => router.refresh()) }); router.push(data.project ? `/team/projects/${data.project.slug}` : "/team"); })}>{lang === "ar" ? "احذف المهمة" : "Delete ticket"}</button></div>
    </>
  );
}
