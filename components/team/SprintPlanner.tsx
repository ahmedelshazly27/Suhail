"use client";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rollOver, startSprint } from "@/app/actions/sprints";
import { updateTicket } from "@/app/actions/tickets";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";
import type { Ticket } from "@/lib/data/tickets";
import type { Person, ProjectLite } from "@/lib/data/shell";

type Cap = { id: string; name: string; avatar: string | null; cap: number; away: number; planned: number };
type Props = { lang: TLang; sprint: { id: string; number: number }; active: { id: string; number: number } | null; unfinished: number; backlog: Ticket[]; planned: Ticket[]; people: Person[]; projects: ProjectLite[]; capacity: Cap[]; calendarLive: boolean };

const PRI_RANK: Record<string, number> = { urgent: 0, high: 1, med: 2, low: 3, none: 4 };

function Row({ t, lang, project, right, onAdd, addLabel }: { t: Ticket; lang: TLang; project?: string; right: React.ReactNode; onAdd?: () => void; addLabel?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  return (
    <div ref={setNodeRef} className="row" style={{ gridTemplateColumns: "1.25rem 4rem minmax(0,1fr) auto auto auto", opacity: isDragging ? 0.4 : 1 }}>
      <span {...attributes} {...listeners} aria-label={`${lang === "ar" ? "اسحب" : "Drag"} ${t.key}`} style={{ cursor: "grab", color: "var(--faint)" }}>⋮⋮</span>
      <span className="key">{t.key}</span>
      <span className="stack-t"><span className="ell">{t.title}</span>{project ? <span className="s">{project}</span> : null}</span>
      {right}
      <span className="key">{t.estimate ?? 0} {tt(lang, "pt")}</span>
      {onAdd ? <button type="button" className="linkbtn" onClick={onAdd} aria-label={`${addLabel} ${t.key}`}>{lang === "ar" ? "←" : "→"}</button> : <span />}
    </div>
  );
}

function Drop({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={className} style={isOver ? { outline: "1px dashed var(--faint)", outlineOffset: 4 } : undefined}>{children}</div>;
}

export function SprintPlanner(p: Props) {
  const { lang } = p;
  const [backlog, setBacklog] = useState([...p.backlog].sort((a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority]));
  const [planned, setPlanned] = useState(p.planned);
  const [drag, setDrag] = useState<Ticket | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), useSensor(KeyboardSensor));
  const proj = (id: string | null) => p.projects.find((x) => x.id === id)?.name;
  const who = (id: string | null) => p.people.find((x) => x.id === id);
  const move = (t: Ticket, into: boolean) => {
    if (into) { setBacklog((b) => b.filter((x) => x.id !== t.id)); setPlanned((s) => [...s, t]); }
    else { setPlanned((s) => s.filter((x) => x.id !== t.id)); setBacklog((b) => [...b, t].sort((a, c) => PRI_RANK[a.priority] - PRI_RANK[c.priority])); }
    start(async () => { await updateTicket(t.id, { sprint_id: into ? p.sprint.id : null, ...(into && t.status === "backlog" ? { status: "todo" } : {}) }); router.refresh(); });
  };
  const onEnd = (e: DragEndEvent) => {
    setDrag(null);
    const t = [...backlog, ...planned].find((x) => x.id === e.active.id);
    if (!t || !e.over) return;
    const into = e.over.id === "sprint";
    if (into !== planned.some((x) => x.id === t.id)) move(t, into);
  };
  const totalPlanned = planned.reduce((n, t) => n + (t.estimate || 0), 0);
  const capTotal = p.capacity.reduce((n, c) => n + Math.max(0, c.cap - c.away), 0);
  const capRows = p.capacity.map((c) => ({ ...c, planned: planned.filter((t) => t.assignee_id === c.id).reduce((n, t) => n + (t.estimate || 0), 0) }));

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDrag([...backlog, ...planned].find((x) => x.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setDrag(null)}>
      <div className="ph-actions" style={{ position: "absolute", insetBlockStart: "1.75rem", insetInlineEnd: "2.5rem" }} />
      {p.active && p.unfinished ? (
        <div className="card soft" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".75rem", padding: ".875rem 1rem", borderRadius: 0 }}>
          <span>{lang === "ar" ? `${p.unfinished} مهام من الدورة ${p.active.number} ما خلصت.` : `${p.unfinished} tickets from Sprint ${p.active.number} are not finished.`}</span>
          <button type="button" className="b ghost" disabled={pending} onClick={() => start(async () => { const n = await rollOver(p.active!.id, p.sprint.id); toast(lang === "ar" ? `انتقلت ${n} مهام` : `${n} tickets moved`); router.refresh(); })}>{lang === "ar" ? `انقلها للدورة ${p.sprint.number}` : `Roll them into Sprint ${p.sprint.number}`}</button>
          <span className="muted">{lang === "ar" ? "أو خلّها في المؤجّل" : "or leave them in the backlog"}</span>
        </div>
      ) : null}
      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}>
        <Drop id="backlog" className="card">
          <div className="card-h"><h2>{tt(lang, "backlog")}</h2><span className="muted" style={{ fontSize: ".78rem" }}>{lang === "ar" ? "مرتّبة حسب الأولوية · اسحب للدورة" : "Sorted by priority · drag into the sprint"}</span></div>
          {backlog.map((t) => <Row key={t.id} t={t} lang={lang} project={proj(t.project_id)} onAdd={() => move(t, true)} addLabel={lang === "ar" ? "أضف للدورة" : "Add to sprint"}
            right={t.priority !== "none" ? <span className={`chip${t.priority === "high" || t.priority === "urgent" ? " attn" : ""}`}>{tt(lang, t.priority as TKey)}</span> : <span />} />)}
          {!backlog.length ? <div className="card-f">{tt(lang, "emptyList")}</div> : null}
        </Drop>
        <div className="col">
          <div className="card soft pad">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2>{tt(lang, "capacity")}</h2>
              <span><span style={{ font: "300 1.75rem/1 var(--f-display)" }} className="num">{totalPlanned}</span> <span className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "of")} {capTotal} {lang === "ar" ? "نقطة مخطّطة" : "points planned"}</span></span>
            </div>
            {capRows.map((c) => { const max = Math.max(0, c.cap - c.away), pct = max ? Math.min(100, Math.round((c.planned / max) * 100)) : 0; return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.5rem 7rem minmax(0,1fr) 3.5rem", gap: ".75rem", alignItems: "center" }}>
                <Avatar name={c.name} src={c.avatar} />
                <span className="stack-t"><span>{c.name.split(" ")[0]}</span><span className="s">{c.away ? (lang === "ar" ? `إجازة ${c.away} يوم` : `Off ${c.away} d`) : c.cap ? tt(lang, "fullSprint") : (lang === "ar" ? "بدون سعة" : "No capacity")}</span></span>
                <span className={`track ink${c.planned > max ? " over" : ""}`}><span style={{ width: pct + "%" }} /></span>
                <span className="num key" style={{ textAlign: "end" }}>{c.planned} / {max}</span>
              </div>); })}
            <span className="muted" style={{ fontSize: ".75rem" }}>{p.calendarLive ? (lang === "ar" ? "الإجازات من تقويم Outlook لكل شخص." : "Time off comes from each person's Outlook calendar.") : (lang === "ar" ? "الإجازات تجي من Outlook بعد ربط Microsoft 365." : "Time off comes from Outlook once Microsoft 365 is connected.")}</span>
          </div>
          <Drop id="sprint" className="card">
            <div className="card-h"><h2>{lang === "ar" ? "في هالدورة" : "In this sprint"}</h2><span className="key">{planned.length} {lang === "ar" ? "مهمة" : "tickets"}</span></div>
            {planned.map((t) => { const a = who(t.assignee_id); return <Row key={t.id} t={t} lang={lang} onAdd={() => move(t, false)} addLabel={lang === "ar" ? "رجّعها للمؤجّل" : "Back to backlog"} right={a ? <Avatar name={a.name} src={a.avatar_url} /> : <span />} />; })}
            <div style={{ padding: ".75rem 1.125rem" }}><div style={{ border: "1px dashed var(--faint)", padding: "1rem", textAlign: "center", fontSize: ".8125rem" }} className="muted">{lang === "ar" ? "اسحب المهام هنا" : "Drop tickets here"}</div></div>
          </Drop>
        </div>
      </div>
      <DragOverlay>{drag ? <div className="bcard dragging"><span className="key">{drag.key}</span><span className="ttl">{drag.title}</span></div> : null}</DragOverlay>
    </DndContext>
  );
}

export function StartSprint({ id, lang, label }: { id: string; lang: TLang; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" className="b" disabled={pending} onClick={() => start(async () => { await startSprint(id); router.refresh(); })} aria-label={label}>{lang === "ar" ? "ابدأ الدورة" : "Start sprint"}</button>;
}
