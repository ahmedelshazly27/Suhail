"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useToast } from "./Toast";
import { tt, type TLang } from "@/lib/team-i18n";

/** Side peek (bottom sheet on phones). Esc closes it; Expand opens the full page. */
export function Peek({ lang, crumb, fullHref, onClose, children }: { lang: TLang; crumb: React.ReactNode; fullHref: string; onClose: () => void; children: React.ReactNode }) {
  const toast = useToast();
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement;
      if (t.closest(".ProseMirror") || t.closest("[cmdk-root]")) return;
      onClose();
    };
    addEventListener("keydown", onKey);
    return () => { removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside className="peek" role="dialog" aria-modal="false" aria-label={typeof crumb === "string" ? crumb : undefined} tabIndex={-1} ref={box}>
        <div className="peek-h">
          <span className="crumb">{crumb}</span>
          <span className="acts">
            <Link href={fullHref}>{tt(lang, "expand")}</Link>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(location.origin + fullHref); toast(tt(lang, "copied")); }}>{tt(lang, "copyLink")}</button>
            <button type="button" onClick={onClose}>{tt(lang, "close")}</button>
          </span>
        </div>
        <div className="peek-b">{children}</div>
      </aside>
    </>
  );
}
