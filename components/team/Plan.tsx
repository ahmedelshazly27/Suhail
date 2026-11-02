"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { addCriterion, addKpiValue, createReview, deleteCriterion, deleteMilestone, saveKpiSettings, saveMilestone, saveWhy, setCriterion } from "@/app/actions/plan";
import { Editor, RichText, type Doc } from "./Editor";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { todayISO } from "@/lib/dates";
import type { Person, ProjectLite } from "@/lib/data/shell";
import { tt, type TLang } from "@/lib/team-i18n";

// Interactive parts of the Plan page. Everything saves through server actions, which check roles again.

type P = { id: string; name: string };
type TicketOpt = { id: string; label: string; done: boolean };
type MStatus = "not_started" | "on_track" | "at_risk" | "done";
type M = { id: string; year: number; quarter: number; department: string; title: string; owner_id: string | null; status: MStatus; project_ids: string[]; ticket_ids: string[]; ticketsDone?: boolean };
const L = (lang: TLang, en: string, ar: string) => (lang === "ar" ? ar : en);
const STATUS: Record<MStatus, [string, string]> = { not_started: ["Not started", "ما بدأ"], on_track: ["On track", "ماشي تمام"], at_risk: ["At risk", "فيه خطر"], done: ["Done", "خلص"] };

function useRun(lang: TLang) {
  const [pending, start] = useTransition();
  const router = useRouter(), toast = useToast();
  return { pending, run: (fn: () => Promise<unknown>, ok?: string) => start(async () => { try { await fn(); if (ok) toast(ok); router.refresh(); } catch (e) { toast((e as Error).message || tt(lang, "error")); } }) };
}

function Dialog({ title, onClose, children, lang, onSubmit }: { title: string; onClose: () => void; children: ReactNode; lang: TLang; onSubmit?: (f: FormData) => void }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="pl-h" action={onSubmit} onSubmit={onSubmit ? undefined : (e) => e.preventDefault()}>
        <div style={{ display: "flex", alignItems: "center" }}><h2 id="pl-h">{title}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={onClose}>×</button></div>
        {children}
      </form>
    </div>
  );
}

export function StatusDot({ s }: { s: MStatus }) {
  return <span className={`ms-dot ${s}`} aria-hidden="true" />;
}

/** Mission, vision and principles. Owners and admins edit in place (saves as you type); everyone else reads. */
export function WhyPanel({ lang, why, canEdit, people }: { lang: TLang; why: { mission?: unknown; vision?: unknown; principles?: unknown }; canEdit: boolean; people: Person[] }) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toast = useToast();
  const parts: ["mission" | "vision" | "principles", string, string][] = [["mission", "Mission", "الرسالة"], ["vision", "Vision", "الرؤية"], ["principles", "Principles", "المبادئ"]];
  return (
    <div className="why">
      {parts.map(([k, en, ar]) => (
        <section key={k} className="card pad">
          <h2 className="why-h">{L(lang, en, ar)}</h2>
          {canEdit ? (
            <Editor value={why[k] as Doc} people={people} label={L(lang, en, ar)} placeholder={L(lang, `Paste the ${en.toLowerCase()} from the plan document.`, `الصق ${ar} من وثيقة الخطة.`)}
              onChange={(d) => { clearTimeout(timers.current[k]); timers.current[k] = setTimeout(() => saveWhy(k, d).catch((e) => toast((e as Error).message)), 800); }} />
          ) : why[k] ? <RichText doc={why[k] as Doc} /> : <p className="muted">{L(lang, "Not written yet.", "ما انكتب للحين.")}</p>}
        </section>
      ))}
    </div>
  );
}

function MilestoneForm({ lang, m, people, projects, tickets, isAdmin, onClose }: { lang: TLang; m: Partial<M> & { department: string; quarter: number; year: number }; people: P[]; projects: ProjectLite[]; tickets: TicketOpt[]; isAdmin: boolean; onClose: () => void }) {
  const { run, pending } = useRun(lang);
  const all = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);
  return (
    <Dialog lang={lang} title={m.id ? L(lang, "Milestone", "الإنجاز") : L(lang, "New milestone", "إنجاز جديد")} onClose={onClose}
      onSubmit={(f) => run(async () => {
        await saveMilestone({ id: m.id, year: m.year, department: String(f.get("department")), quarter: Number(f.get("quarter")), title: String(f.get("title")), owner_id: String(f.get("owner_id") || "") || null,
          status: String(f.get("status")) as MStatus, project_ids: all(f, "project_ids"), ticket_ids: all(f, "ticket_ids") });
        onClose();
      }, tt(lang, "saved"))}>
      {m.ticketsDone && m.status !== "done" ? (
        <p className="chip attn" style={{ alignSelf: "flex-start" }}>{L(lang, "Every linked ticket is done. Mark it done?", "كل المهام المربوطة خلصت. نعتبره خلص؟")}</p>
      ) : null}
      <label className="fld"><span>{L(lang, "Title", "العنوان")}</span><input name="title" defaultValue={m.title} required maxLength={200} readOnly={!isAdmin} autoFocus={!m.id} /></label>
      <div className="grid-2" style={{ gap: ".75rem" }}>
        <label className="fld"><span>{L(lang, "Status", "الحالة")}</span><select name="status" defaultValue={m.ticketsDone && m.status !== "done" ? "done" : m.status ?? "not_started"}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{L(lang, ...l)}</option>)}</select></label>
        <label className="fld"><span>{tt(lang, "owner")}</span><select name="owner_id" defaultValue={m.owner_id ?? ""} disabled={!isAdmin}><option value="">–</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{!isAdmin ? <input type="hidden" name="owner_id" value={m.owner_id ?? ""} /> : null}</label>
        <label className="fld"><span>{L(lang, "Department", "القسم")}</span><input name="department" defaultValue={m.department} required readOnly={!isAdmin} /></label>
        <label className="fld"><span>{L(lang, "Quarter", "الربع")}</span><select name="quarter" defaultValue={m.quarter} disabled={!isAdmin}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select>{!isAdmin ? <input type="hidden" name="quarter" value={m.quarter} /> : null}</label>
      </div>
      <label className="fld"><span>{tt(lang, "projects")}</span><select name="project_ids" multiple size={Math.min(4, Math.max(2, projects.length))} defaultValue={m.project_ids ?? []} disabled={!isAdmin}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {!isAdmin ? (m.project_ids ?? []).map((id) => <input key={id} type="hidden" name="project_ids" value={id} />) : null}</label>
      <label className="fld"><span>{L(lang, "Tickets (it suggests Done when all are done)", "المهام (يقترح «خلص» لما تخلص كلها)")}</span><select name="ticket_ids" multiple size={4} defaultValue={m.ticket_ids ?? []} disabled={!isAdmin}>{tickets.map((t) => <option key={t.id} value={t.id}>{t.done ? "✓ " : ""}{t.label}</option>)}</select>
        {!isAdmin ? (m.ticket_ids ?? []).map((id) => <input key={id} type="hidden" name="ticket_ids" value={id} />) : null}</label>
      <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
        {m.id && isAdmin ? <button type="button" className="b quiet" style={{ marginInlineEnd: "auto" }} disabled={pending} onClick={() => confirm(L(lang, "Delete this milestone?", "تحذف هذا الإنجاز؟")) && run(async () => { await deleteMilestone(m.id!); onClose(); })}>{L(lang, "Delete", "احذف")}</button> : null}
        <button type="button" className="b quiet" onClick={onClose}>{tt(lang, "cancel")}</button>
        <button className="b" type="submit" disabled={pending}>{tt(lang, "save")}</button>
      </div>
    </Dialog>
  );
}

/** One milestone in a roadmap cell. Opens the editor for owners, admins and the milestone's owner. */
export function MilestoneItem({ lang, m, people, projects, tickets, canEdit, isAdmin }: { lang: TLang; m: M; people: P[]; projects: ProjectLite[]; tickets: TicketOpt[]; canEdit: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const owner = people.find((p) => p.id === m.owner_id);
  const body = (
    <>
      <StatusDot s={m.status} />
      <span className="ms-t" dir="auto">{m.title}</span>
      {m.ticketsDone && m.status !== "done" ? <span className="chip attn">{L(lang, "Mark done?", "خلص؟")}</span> : null}
      {owner ? <Avatar name={owner.name} /> : null}
      <span className="vh-sr">, {L(lang, ...STATUS[m.status])}{owner ? `, ${owner.name}` : ""}</span>
    </>
  );
  return (
    <>
      {canEdit ? <button type="button" className={`ms ${m.status}`} onClick={() => setOpen(true)}>{body}</button> : <div className={`ms ${m.status}`}>{body}</div>}
      {open ? <MilestoneForm lang={lang} m={m} people={people} projects={projects} tickets={tickets} isAdmin={isAdmin} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function AddMilestone({ lang, department, quarter, year, people, projects, tickets }: { lang: TLang; department: string; quarter: number; year: number; people: P[]; projects: ProjectLite[]; tickets: TicketOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ms-add" onClick={() => setOpen(true)} aria-label={L(lang, `Add a milestone, ${department}, Q${quarter}`, `أضف إنجاز، ${department}، الربع ${quarter}`)}>+</button>
      {open ? <MilestoneForm lang={lang} m={{ department, quarter, year, status: "not_started" }} people={people} projects={projects} tickets={tickets} isAdmin onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** A gate and its checklist. Owners and admins tick criteria and add new ones. */
export function GateChecklist({ lang, gate, canEdit, when }: { lang: TLang; gate: { id: string; title: string; criteria: { id: string; text: string; met: boolean }[] }; canEdit: boolean; when: string }) {
  const { run, pending } = useRun(lang);
  const [text, setText] = useState("");
  const met = gate.criteria.filter((c) => c.met).length;
  return (
    <div className={`card pad gate${gate.criteria.length && met === gate.criteria.length ? " met" : ""}`}>
      <div className="kpi-h"><span className="eb">{when}</span><span className="key">{met}/{gate.criteria.length}</span></div>
      <h3 className="gate-t" dir="auto">{gate.title}</h3>
      <ul className="crit">{gate.criteria.map((c) => (
        <li key={c.id}>
          <label><input type="checkbox" checked={c.met} disabled={!canEdit || pending} onChange={(e) => run(() => setCriterion(c.id, e.target.checked))} /> <span>{c.text}</span></label>
          {canEdit ? <button type="button" className="linkbtn" aria-label={`${L(lang, "Delete", "احذف")}: ${c.text}`} onClick={() => confirm(L(lang, "Remove this criterion?", "تشيل هذا الشرط؟")) && run(() => deleteCriterion(c.id))}>×</button> : null}
        </li>
      ))}</ul>
      {canEdit ? (
        <form className="crit-add" action={() => { if (text.trim()) run(async () => { await addCriterion(gate.id, text); setText(""); }); }}>
          <input className="inp" value={text} onChange={(e) => setText(e.target.value)} placeholder={L(lang, "Add a criterion", "أضف شرط")} aria-label={L(lang, "Add a criterion", "أضف شرط")} maxLength={200} />
          <button className="b quiet" type="submit" disabled={pending || !text.trim()}>{L(lang, "Add", "أضف")}</button>
        </form>
      ) : null}
    </div>
  );
}

type KpiLite = { id: string; name: string; unit: "count" | "percent" | "usd"; source: "auto" | "manual"; owner_id: string | null; targets: Record<number, number>; checkpoints: Record<number, number>; history: { value: number; on_date: string; note: string }[] };

/** Enter a manual value (its owner, owners and admins), see its history, and edit owner and targets (owners and admins). */
export function KpiActions({ lang, kpi, people, canEdit, canEnter, year }: { lang: TLang; kpi: KpiLite; people: P[]; canEdit: boolean; canEnter: boolean; year: number }) {
  const [open, setOpen] = useState<"value" | "settings" | "history" | null>(null);
  const { run, pending } = useRun(lang);
  const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number(v));
  return (
    <span className="kpi-actions">
      {kpi.history.length ? <button type="button" className="linkbtn" onClick={() => setOpen("history")}>{L(lang, "History", "السجل")}</button> : null}
      {canEnter ? <button type="button" className="b quiet sm" onClick={() => setOpen("value")}>{L(lang, "Enter value", "أدخل القيمة")}</button> : null}
      {canEdit ? <button type="button" className="linkbtn" onClick={() => setOpen("settings")}>{L(lang, "Targets", "الأهداف")}</button> : null}
      {open === "value" ? (
        <Dialog lang={lang} title={kpi.name} onClose={() => setOpen(null)} onSubmit={(f) => run(async () => { await addKpiValue({ kpi_id: kpi.id, value: Number(f.get("value")), on_date: String(f.get("on_date")), note: String(f.get("note") || "") }); setOpen(null); }, tt(lang, "saved"))}>
          <div className="grid-2" style={{ gap: ".75rem" }}>
            <label className="fld"><span>{L(lang, "Value", "القيمة")}{kpi.unit === "percent" ? " (%)" : kpi.unit === "usd" ? " (USD)" : ""}</span><input name="value" type="number" min="0" step="any" inputMode="decimal" required autoFocus /></label>
            <label className="fld"><span>{tt(lang, "when")}</span><input name="on_date" type="date" defaultValue={todayISO()} required /></label>
          </div>
          <label className="fld"><span>{L(lang, "Note", "ملاحظة")}</span><textarea name="note" maxLength={500} /></label>
          <p className="muted" style={{ fontSize: ".75rem", margin: 0 }}>{L(lang, "Values are kept as history. To correct one, enter a new value.", "القيم تنحفظ كسجل. للتصحيح، أدخل قيمة جديدة.")}</p>
          <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}><button type="button" className="b quiet" onClick={() => setOpen(null)}>{tt(lang, "cancel")}</button><button className="b" type="submit" disabled={pending}>{tt(lang, "save")}</button></div>
        </Dialog>
      ) : null}
      {open === "history" ? (
        <Dialog lang={lang} title={`${kpi.name}: ${L(lang, "history", "السجل")}`} onClose={() => setOpen(null)}>
          <ul className="hist">{kpi.history.map((h, i) => <li key={i}><span className="key">{h.on_date}</span><span className="num">{h.value.toLocaleString("en")}</span><span className="muted" dir="auto">{h.note}</span></li>)}</ul>
        </Dialog>
      ) : null}
      {open === "settings" ? (
        <Dialog lang={lang} title={kpi.name} onClose={() => setOpen(null)} onSubmit={(f) => run(async () => {
          await saveKpiSettings({ id: kpi.id, owner_id: String(f.get("owner_id") || "") || null,
            targets: Object.fromEntries([2027, 2028, 2029].map((y) => [String(y), num(f.get(`t${y}`))])),
            checkpoints: Object.fromEntries([1, 2, 3, 4].map((q) => [String(q), num(f.get(`q${q}`))])) }, year);
          setOpen(null);
        }, tt(lang, "saved"))}>
          <label className="fld"><span>{tt(lang, "owner")}</span><select name="owner_id" defaultValue={kpi.owner_id ?? ""}><option value="">–</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="grid-3 tight">{[2027, 2028, 2029].map((y) => <label key={y} className="fld"><span>{L(lang, `Target ${y}`, `هدف ${y}`)}</span><input name={`t${y}`} type="number" min="0" step="any" defaultValue={kpi.targets[y] ?? ""} /></label>)}</div>
          <div className="grid-4 tight">{[1, 2, 3, 4].map((q) => <label key={q} className="fld"><span>Q{q} {year}</span><input name={`q${q}`} type="number" min="0" step="any" defaultValue={kpi.checkpoints[q] ?? ""} /></label>)}</div>
          <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}><button type="button" className="b quiet" onClick={() => setOpen(null)}>{tt(lang, "cancel")}</button><button className="b" type="submit" disabled={pending}>{tt(lang, "save")}</button></div>
        </Dialog>
      ) : null}
    </span>
  );
}

/** End-of-quarter review: takes a snapshot of the plan and the three notes. It can't be changed afterwards. */
export function ReviewForm({ lang, year, quarter, taken }: { lang: TLang; year: number; quarter: number; taken: number[] }) {
  const { run, pending } = useRun(lang);
  const free = [1, 2, 3, 4].filter((q) => !taken.includes(q));
  const [open, setOpen] = useState(false);
  if (!free.length) return null;
  return open ? (
    <form className="card pad" aria-labelledby="rv-h" action={(f) => {
      if (!confirm(L(lang, "Save the review? The snapshot and notes can't be changed afterwards.", "تحفظ المراجعة؟ اللقطة والملاحظات ما تتغيّر بعدين."))) return;
      run(async () => { await createReview({ quarter: Number(f.get("quarter")), went_well: String(f.get("went_well")), went_badly: String(f.get("went_badly")), will_change: String(f.get("will_change")) }, year); setOpen(false); }, tt(lang, "saved"));
    }}>
      <h2 id="rv-h">{L(lang, "New quarterly review", "مراجعة ربع جديدة")}</h2>
      <label className="fld" style={{ maxWidth: "10rem" }}><span>{L(lang, "Quarter", "الربع")}</span><select name="quarter" defaultValue={free.includes(quarter) ? quarter : free[0]}>{free.map((q) => <option key={q} value={q}>Q{q} {year}</option>)}</select></label>
      <label className="fld"><span>{L(lang, "What went well", "وش مشى زين")}</span><textarea name="went_well" maxLength={4000} required /></label>
      <label className="fld"><span>{L(lang, "What didn't", "وش ما مشى")}</span><textarea name="went_badly" maxLength={4000} required /></label>
      <label className="fld"><span>{L(lang, "What we change", "وش بنغيّر")}</span><textarea name="will_change" maxLength={4000} required /></label>
      <p className="muted" style={{ fontSize: ".75rem", margin: 0 }}>{L(lang, "Saving takes a snapshot of every milestone and KPI right now. Reviews are read-only and kept forever.", "الحفظ ياخذ لقطة لكل الإنجازات والمؤشرات الحين. المراجعات للقراءة بس وتنحفظ للأبد.")}</p>
      <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}><button type="button" className="b quiet" onClick={() => setOpen(false)}>{tt(lang, "cancel")}</button><button className="b" type="submit" disabled={pending}>{L(lang, "Save review", "احفظ المراجعة")}</button></div>
    </form>
  ) : <button type="button" className="b" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>{L(lang, "New quarterly review", "مراجعة ربع جديدة")}</button>;
}
