"use client";
import { useState } from "react";
import { subscribe } from "@/app/actions/public";
import { t, type Lang } from "@/lib/i18n";
import { Turnstile, resetTurnstile } from "./Turnstile";

/** The prototype's subscribe boxes: underline (home), pill (season, jobs) or the gate card. */
export function QuickSubscribe({ lang, source, variant, label, msgStyle }: { lang: Lang; source: string; variant: "sub" | "pillform" | "gate"; label: string; msgStyle?: React.CSSProperties }) {
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector("input")!;
    const v = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setMsg({ text: t(lang, "sub_bad"), err: true });
    setBusy(true);
    const r = await subscribe({ email: v, source, lang, token }).catch(() => ({ ok: false as const, problem: "err" as const }));
    setBusy(false); resetTurnstile();
    if (r.ok) { setMsg({ text: t(lang, "sub_ok"), err: false }); input.value = ""; }
    else setMsg({ text: t(lang, r.problem === "bad_email" ? "sub_bad" : "err"), err: true });
  }
  const id = `sub-${source}`;
  const form = (
    <form className={variant === "gate" ? "gateform" : variant} onSubmit={onSubmit} noValidate style={variant === "gate" ? { display: "grid", gap: ".6rem", border: 0, maxWidth: "none" } : undefined}>
      <label htmlFor={id} className="vh-sr">{t(lang, "email_ph")}</label>
      <input id={id} type="email" size={10} placeholder={t(lang, "email_ph")} autoComplete="email" dir="ltr" required />
      <button type="submit" disabled={busy}>{label}</button>
    </form>
  );
  return (
    <>
      {form}
      <Turnstile lang={lang} onToken={setToken} />
      <p className={"sub-msg" + (msg?.err ? " err" : "")} role="status" style={msgStyle}>{msg?.text ?? ""}</p>
    </>
  );
}
