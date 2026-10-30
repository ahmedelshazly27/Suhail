"use client";
import { useActionState } from "react";
import { postStandup } from "@/app/actions/standup";
import { tt, type TLang } from "@/lib/team-i18n";

export function Standup({ lang, initial, count, total }: { lang: TLang; initial: { done: string; next: string; blockers: string } | null; count: number; total: number }) {
  const [state, action, pending] = useActionState(postStandup, null);
  return (
    <form action={action} className="card soft pad">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ color: "var(--fg-2)" }}>{tt(lang, "standup")}</h2>
        <span className="key">{count} {tt(lang, "of")} {total} {tt(lang, "answered")}</span>
      </div>
      <label className="fld"><span>{tt(lang, "doneYesterday")}</span><input name="done" defaultValue={initial?.done} /></label>
      <label className="fld"><span>{tt(lang, "next")}</span><input name="next" defaultValue={initial?.next} placeholder={tt(lang, "nextPh")} /></label>
      <label className="fld"><span>{tt(lang, "blockers")}</span><input name="blockers" defaultValue={initial?.blockers} placeholder={tt(lang, "blockersPh")} /></label>
      <div style={{ display: "flex", alignItems: "center", gap: ".625rem" }}>
        <button className="b" type="submit" disabled={pending}>{tt(lang, "post")}</button>
        <span className="muted" style={{ fontSize: ".75rem" }} role="status">{state?.ok ? tt(lang, "posted") : `${tt(lang, "alsoTeams")} 9:00`}</span>
      </div>
    </form>
  );
}
