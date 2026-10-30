"use client";
// First-sign-in walkthrough. Each step spotlights the real control (sidebar on desktop, tab bar on phones) through
// data-tour attributes; a step whose control isn't on screen is skipped, and intro and outro steps sit centred.
// Finishing or skipping sets profiles.toured_at; Settings can clear it to replay.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { finishTour } from "@/app/actions/me";
import type { TLang } from "@/lib/team-i18n";

type Step = { at?: string[]; optional?: boolean; t: Record<TLang, [string, string]> };

const STEPS: Step[] = [
  { t: { en: ["Welcome to Suhail", "A one-minute tour of where things live. Skip it any time and replay it from Settings."], ar: ["هلا فيك في سهيل", "جولة سريعة تعرّفك وين كل شي. تقدر تتخطاها أي وقت وتعيدها من الإعدادات."] } },
  { at: ["home"], t: { en: ["Home", "Your day at a glance: what's due, what changed and the team's stand-up."], ar: ["الرئيسية", "يومك بنظرة: اللي عليك اليوم، وش تغيّر، والاجتماع اليومي للفريق."] } },
  { at: ["inbox"], t: { en: ["Inbox", "Mentions, assignments and approvals, next to your Outlook mail and the shared mailboxes."], ar: ["الوارد", "الإشارات والمهام والموافقات، جنب بريد Outlook والصناديق المشتركة."] } },
  { at: ["myWork"], t: { en: ["My work", "Every ticket assigned to you, across all projects, sorted by due date."], ar: ["شغلي", "كل التذاكر المسندة لك من كل المشاريع، مرتّبة حسب الموعد."] } },
  { at: ["projects", "more"], t: { en: ["Projects and sprints", "Boards, timelines, docs and files for each project. Plan a sprint by dragging tickets into it."], ar: ["المشاريع والدورات", "لكل مشروع لوحة وجدول زمني ومستندات وملفات. خطّط الدورة بسحب التذاكر لها."] } },
  { at: ["workspace"], optional: true, t: { en: ["Hiring, partners and content", "Applications, relationships, the content calendar, the newsletter, Drive and Finance."], ar: ["التوظيف والشركاء والمحتوى", "الطلبات والعلاقات وتقويم المحتوى والنشرة والملفات والمالية."] } },
  { at: ["search"], t: { en: ["Search and quick capture", "Press ⌘K (Ctrl K) to find anything or jump to a page. Press C anywhere to capture a ticket."], ar: ["البحث والإضافة السريعة", "اضغط ⌘K (أو Ctrl K) عشان تلقى أي شي أو تنتقل لأي صفحة، واضغط C من أي مكان عشان تضيف تذكرة."] } },
  { at: ["settings"], t: { en: ["Settings", "Language, theme, your calendar feed, notifications and the Microsoft 365 connection. Replay this tour from here."], ar: ["الإعدادات", "اللغة والمظهر ورابط تقويمك والتنبيهات وربط Microsoft 365. ومن هنا تعيد الجولة."] } },
  { t: { en: ["You're all set", "That's everything. Home is the best place to start."], ar: ["كل شي جاهز", "خلصت الجولة. أحسن مكان تبدأ منه هو الرئيسية."] } },
];
const L = { en: { skip: "Skip tour", back: "Back", next: "Next", done: "Let's go", of: "of" }, ar: { skip: "تخطَّ الجولة", back: "رجوع", next: "التالي", done: "يلا نبدأ", of: "من" } };

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (el as HTMLElement).offsetParent !== null; };
const find = (s: Step) => s.at?.flatMap((k) => Array.from(document.querySelectorAll(`[data-tour="${k}"]`))).find(visible) ?? null;
const usable = (s: Step) => !s.at || !!find(s);

type Box = { top: number; start: number; width: number; height: number };
const PAD = 6, GAP = 12, EDGE = 16;

const noop = () => () => {};
// Set on close, so a quick client-side navigation can't re-show the tour while the save is still in flight.
let dismissed = false;
export const allowTourAgain = () => { dismissed = false; }; // Settings, "Replay the tour"

export function Tour({ lang }: { lang: TLang }) {
  const client = useSyncExternalStore(noop, () => true, () => false); // steps read the DOM, so nothing on the server
  const [open, setOpen] = useState(() => !dismissed);
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; start: number } | null>(null);
  const card = useRef<HTMLDivElement>(null), nextBtn = useRef<HTMLButtonElement>(null);
  const rtl = lang === "ar";
  const step = STEPS[i], last = i === STEPS.length - 1;

  const close = useCallback(() => { dismissed = true; setOpen(false); finishTour().catch(() => {}); }, []);
  const go = useCallback((d: 1 | -1) => {
    let j = i + d;
    while (j > 0 && j < STEPS.length - 1 && !usable(STEPS[j])) j += d; // controls that aren't on this screen size
    if (j < 0) return;
    if (j >= STEPS.length) return close();
    setI(j);
  }, [i, close]);

  // Spotlight and card position in viewport pixels, measured physically (x from the viewport's start in LTR) and
  // stored as inset-inline-start.
  const place = useCallback(() => {
    const el = find(step), c = card.current;
    if (!el || !c) { setHole(null); setPos(null); return; }
    const r = el.getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight, vw = innerWidth, vh = innerHeight;
    const start = (x: number, w: number) => (rtl ? vw - x - w : x);
    setHole({ top: r.top - PAD, start: start(r.x - PAD, r.width + 2 * PAD), width: r.width + 2 * PAD, height: r.height + 2 * PAD });
    const clampX = (x: number) => Math.max(EDGE, Math.min(vw - cw - EDGE, x)), clampY = (y: number) => Math.max(EDGE, Math.min(vh - ch - EDGE, y));
    // Beside the target (the sidebar) when there's room on its inline-end side, otherwise above or below it.
    const besideX = rtl ? r.x - PAD - GAP - cw : r.x + r.width + PAD + GAP;
    if (besideX >= EDGE && besideX + cw <= vw - EDGE && r.width < vw / 3) return setPos({ top: clampY(r.top - PAD), start: start(besideX, cw) });
    const below = r.bottom + PAD + GAP;
    const top = below + ch <= vh - EDGE ? below : r.top - PAD - GAP - ch;
    setPos({ top: clampY(top), start: start(clampX(rtl ? r.x + r.width - cw : r.x), cw) });
  }, [step, rtl]);

  useLayoutEffect(() => {
    if (!open || !client) return;
    find(step)?.scrollIntoView({ block: "nearest" });
    place();
  }, [open, client, step, place]);

  useEffect(() => {
    if (!open) return;
    nextBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go((e.key === "ArrowRight") !== rtl ? 1 : -1); }
      else if (e.key === "Tab" && card.current) { // keep focus inside the card
        const f = Array.from(card.current.querySelectorAll<HTMLElement>("button")), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    addEventListener("keydown", onKey, true);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => { removeEventListener("keydown", onKey, true); removeEventListener("resize", place); removeEventListener("scroll", place, true); };
  }, [open, i, go, close, place, rtl]);

  if (!open || !client) return null;
  const n = STEPS.filter((s) => usable(s)).length, k = STEPS.slice(0, i + 1).filter((s) => usable(s)).length;
  return (
    <div className="tour" data-testid="tour">
      <div className={`tour-veil${hole ? " clear" : ""}`} aria-hidden="true" />
      {hole ? <div className="tour-hole" aria-hidden="true" style={{ top: hole.top, insetInlineStart: hole.start, width: hole.width, height: hole.height }} /> : null}
      <div ref={card} className={`tour-card${pos ? "" : " centred"}`} role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-p"
        style={pos ? { top: pos.top, insetInlineStart: pos.start } : undefined}>
        <span className="tour-n">{k} {L[lang].of} {n}</span>
        <h2 id="tour-h">{step.t[lang][0]}</h2>
        <p id="tour-p">{step.t[lang][1]}</p>
        <div className="tour-f">
          {last ? <span /> : <button type="button" className="linkbtn" onClick={close}>{L[lang].skip}</button>}
          <span className="spacer" />
          {i > 0 ? <button type="button" className="b quiet" onClick={() => go(-1)}>{L[lang].back}</button> : null}
          <button ref={nextBtn} type="button" className="b" onClick={() => (last ? close() : go(1))}>{last ? L[lang].done : L[lang].next}</button>
        </div>
      </div>
    </div>
  );
}
