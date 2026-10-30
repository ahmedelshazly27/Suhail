"use client";
import { useActionState } from "react";
import { sendOwnerLink } from "@/app/actions/auth";
import { tt, type TLang } from "@/lib/team-i18n";

export function OwnerLinkForm({ lang }: { lang: TLang }) {
  const [state, action, pending] = useActionState(sendOwnerLink, null);
  return (
    <form action={action} style={{ display: "grid", gap: ".625rem", textAlign: "start" }}>
      <label className="fld"><span>{tt(lang, "emailAddr")}</span><input name="email" type="email" autoComplete="email" dir="ltr" required /></label>
      <button className="b ghost" type="submit" disabled={pending}>{tt(lang, "sendLink")}</button>
      <small role="status">{state ? tt(lang, state.msg === "error" ? "error" : state.msg) : tt(lang, "devLoginNote")}</small>
    </form>
  );
}
