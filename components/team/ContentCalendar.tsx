"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveContent, requestReview, saveContent } from "@/app/actions/workspace";
import { useToast } from "@/components/ui/Toast";
import { todayISO } from "@/lib/dates";
import { tt, type TLang } from "@/lib/team-i18n";
import type { Person } from "@/lib/data/shell";

export type Item = { id: string; channel: string; title: string; status: string; publish_on: string | null; owner_id: string | null; reviewer_id: string | null; notes: string };
const CH: Record<string, [string, string]> = { linkedin: ["LI", "LinkedIn"], instagram: ["IG", "Instagram"], x: ["X", "X"], newsletter: ["NL", "Newsletter"], podcast: ["PC", "Podcast"] };
const solid = (s: string) => s === "approved" || s === "scheduled" || s === "published";

export function ContentCalendar({ lang, month, items, people, meId, eventDays }: { lang: TLang; month: string; items: Item[]; people: Person[]; meId: string; eventDays: string[] }) {
  const [, start] = useTransition();
  const [edit, setEdit] = useState<Item | null>(null);
  const [chan, setChan] = useState<string | null>(null);
  const router = useRouter(), toast = useToast();
  const first = new Date(month + "-01T12:00:00Z");
  const lead = first.getUTCDay();
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setUTCDate(1 - lead + i); return d.toISOString().slice(0, 10); });
  const rows = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  const fmt = (o: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { ...o, timeZone: "UTC" }).format(d);
  const shift = (n: number) => { const d = new Date(first); d.setUTCMonth(d.getUTCMonth() + n); router.push(`?m=${d.toISOString().slice(0, 7)}`); };
  const shown = items.filter((i) => !chan || i.channel === chan);
  const review = items.filter((i) => i.status === "in_review");
  const today = todayISO();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 16.5rem", gap: "1.75rem", alignItems: "start" }} className="content-grid">
      <div className="col">
        <header className="ph">
          <div className="ph-t"><span className="eb">{lang === "ar" ? "التحرير" : "Editorial"}</span><h1><button type="button" className="linkbtn" style={{ fontSize: "1rem", textDecoration: "none" }} onClick={() => shift(-1)} aria-label={lang === "ar" ? "الشهر السابق" : "Previous month"}>{lang === "ar" ? "›" : "‹"}</button> {fmt({ month: "long", year: "numeric" }, first)} <button type="button" className="linkbtn" style={{ fontSize: "1rem", textDecoration: "none" }} onClick={() => shift(1)} aria-label={lang === "ar" ? "الشهر الجاي" : "Next month"}>{lang === "ar" ? "‹" : "›"}</button></h1></div>
          <div className="ph-actions">{Object.entries(CH).map(([k, [c, n]]) => <button key={k} type="button" className="pill-s" aria-pressed={chan === k} onClick={() => setChan(chan === k ? null : k)} style={{ fontSize: ".8125rem", padding: ".375rem .75rem" }}><span className="key">{c}</span>{n}</button>)}</div>
        </header>
        <div className="card cal" role="grid" aria-label={fmt({ month: "long", year: "numeric" }, first)}>
          <div className="cal-h" role="row">{Array.from({ length: 7 }, (_, i) => <span key={i} role="columnheader">{fmt({ weekday: "short" }, new Date(Date.UTC(2026, 10, 1 + i)))}</span>)}</div>
          {Array.from({ length: rows.length / 7 }, (_, w) => (
            <div key={w} className="cal-w" role="row">{rows.slice(w * 7, w * 7 + 7).map((d) => {
              const out = d.slice(0, 7) !== month, list = shown.filter((i) => i.publish_on === d), hot = eventDays.includes(d);
              return (
                <div key={d} role="gridcell" className={`cal-d${out ? " out" : ""}${d === today ? " today" : ""}${hot ? " hot" : ""}`} onDoubleClick={() => start(async () => { await saveContent(null, { publish_on: d, title: lang === "ar" ? "منشور جديد" : "New post", channel: chan as "linkedin" ?? "linkedin" }); router.refresh(); })}>
                  <span className="n num">{Number(d.slice(8))}</span>
                  {out ? null : list.map((i) => <button key={i.id} type="button" className={`cal-i${solid(i.status) ? " solid" : ""}`} onClick={() => setEdit(i)} title={`${CH[i.channel][1]}: ${i.title}`}><span className="key">{CH[i.channel][0]}</span> {i.title}</button>)}
                </div>);
            })}</div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: ".78rem" }}>{lang === "ar" ? "حافة كاملة: معتمد أو مجدول. متقطّعة: مسودة أو للمراجعة. التواريخ تظهر في تقويم Outlook للكل. اضغط مرتين على يوم لإضافة منشور." : "Solid edge: approved or scheduled. Dashed: draft or in review. Dates also show in everyone's Outlook calendar. Double-click a day to add a post."}</p>
      </div>
      <aside className="col" aria-label={lang === "ar" ? "تحتاج مراجعة" : "Needs review"}>
        <h2 style={{ margin: "1.5rem 0 0", font: "500 .875rem/1.4 var(--f-body)" }}>{lang === "ar" ? "تحتاج مراجعة" : "Needs review"}</h2>
        {review.length ? review.map((i) => (
          <div key={i.id} className="card pad">
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="key">{CH[i.channel][1]}</span><span className="key">{i.publish_on ? fmt({ day: "numeric", month: "short" }, new Date(i.publish_on + "T12:00:00Z")) : ""}</span></div>
            <span>{i.title}</span><span className="muted" style={{ fontSize: ".75rem" }}>{people.find((p) => p.id === i.owner_id)?.name.split(" ")[0]}{i.reviewer_id === meId ? (lang === "ar" ? " طلب منك" : " asked you") : ""}{i.notes ? ` · ${i.notes}` : ""}</span>
            <div style={{ display: "flex", gap: ".5rem" }}><button type="button" className="b" onClick={() => start(async () => { await approveContent(i.id); toast(tt(lang, "approved")); router.refresh(); })}>{tt(lang, "approve")}</button><button type="button" className="b quiet" onClick={() => setEdit(i)}>{lang === "ar" ? "علّق" : "Comment"}</button></div>
          </div>
        )) : <p className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "emptyList")}</p>}
      </aside>
      {edit ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setEdit(null)} onKeyDown={(e) => e.key === "Escape" && setEdit(null)}>
          <form className="dialog" role="dialog" aria-modal="true" aria-label={edit.title} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => {
            await saveContent(edit.id, { title: String(f.get("title")), channel: String(f.get("channel")) as "linkedin", status: String(f.get("status")) as "draft", publish_on: String(f.get("publish_on")) || null, owner_id: String(f.get("owner")) || null, notes: String(f.get("notes")) });
            setEdit(null); router.refresh(); }); }}>
            <div style={{ display: "flex", alignItems: "center" }}><h2>{CH[edit.channel][1]}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={() => setEdit(null)}>×</button></div>
            <label className="fld"><span>{lang === "ar" ? "العنوان" : "Title"}</span><input name="title" defaultValue={edit.title} required /></label>
            <div className="grid-2" style={{ gap: ".75rem" }}>
              <label className="fld"><span>{tt(lang, "channel")}</span><select name="channel" defaultValue={edit.channel}>{Object.entries(CH).map(([k, [, n]]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="fld"><span>{tt(lang, "status")}</span><select name="status" defaultValue={edit.status}>{["draft", "in_review", "approved", "scheduled", "published"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
              <label className="fld"><span>{lang === "ar" ? "تاريخ النشر" : "Publish on"}</span><input name="publish_on" type="date" defaultValue={edit.publish_on ?? ""} /></label>
              <label className="fld"><span>{tt(lang, "owner2")}</span><select name="owner" defaultValue={edit.owner_id ?? ""}><option value="">{tt(lang, "unassigned")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            </div>
            <label className="fld"><span>{lang === "ar" ? "ملاحظات" : "Notes"}</span><textarea name="notes" defaultValue={edit.notes} /></label>
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
              {edit.status === "draft" ? <button type="button" className="b quiet" onClick={() => start(async () => { await requestReview(edit.id); setEdit(null); toast(tt(lang, "saved")); router.refresh(); })}>{tt(lang, "requestReview")}</button> : null}
              <button type="submit" className="b">{tt(lang, "save")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
