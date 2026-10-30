"use client";
import { useEffect, useRef } from "react";

/** Prototype modal: backdrop, sheet, Esc and backdrop click close it, focus stays inside and returns to the trigger. */
export function Modal({ open, onClose, title, intro, closeLabel, children }: { open: boolean; onClose: () => void; title: string; intro?: string; closeLabel: string; children: React.ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    setTimeout(() => sheet.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheet.current) return;
      const els = [...sheet.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not(.vh), textarea, select, label.pill")].filter((x) => x.offsetParent);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    addEventListener("keydown", onKey);
    return () => { removeEventListener("keydown", onKey); trigger?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="m-title" ref={sheet}>
        <div className="sh"><h2 id="m-title">{title}</h2><button className="x" type="button" aria-label={closeLabel} onClick={onClose}>×</button></div>
        {intro ? <p className="muted" id="m-p">{intro}</p> : null}
        {children}
      </div>
    </div>
  );
}
