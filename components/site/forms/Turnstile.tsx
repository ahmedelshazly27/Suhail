"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
    __tsLoading?: Promise<void>;
  }
}
const load = () =>
  (window.__tsLoading ??= new Promise<void>((res) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = () => res(); document.head.appendChild(s);
  }));

/** Invisible unless Cloudflare needs an interaction. Calls onToken with each fresh token. */
export function Turnstile({ lang, onToken }: { lang: "ar" | "en"; onToken: (t: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);
  useEffect(() => {
    let id: string | undefined;
    let gone = false;
    load().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
        appearance: "interaction-only", language: lang, theme: "auto",
        callback: (t: string) => cb.current(t), "expired-callback": () => cb.current(null), "error-callback": () => cb.current(null),
      });
    });
    return () => { gone = true; if (id && window.turnstile) window.turnstile.remove(id); };
  }, [lang]);
  return <div ref={box} className="ts" />;
}
export const resetTurnstile = () => window.turnstile?.reset();
