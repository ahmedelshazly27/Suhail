"use client";
// A page that fails (Microsoft or the database not answering) shows this inside the dashboard, with a retry,
// instead of a blank error page.
import Link from "next/link";
import { useSyncExternalStore } from "react";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ar = useSyncExternalStore(() => () => {}, () => document.documentElement.lang === "ar", () => false);
  return (
    <div className="empty" style={{ padding: "3rem 1.5rem" }} role="alert">
      <h1 style={{ margin: 0, font: "300 1.75rem/1.2 var(--f-display)", color: "var(--fg)" }}>{ar ? "ما قدرنا نفتح الصفحة" : "This page didn't load"}</h1>
      <p>{ar ? "غالبًا انقطاع مؤقت. جرّب مرة ثانية." : "Probably a temporary hiccup. Try again."}</p>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <button type="button" className="b" onClick={reset}>{ar ? "حاول مرة ثانية" : "Try again"}</button>
        <Link className="b quiet" href="/team">{ar ? "الرئيسية" : "Home"}</Link>
      </div>
    </div>
  );
}
