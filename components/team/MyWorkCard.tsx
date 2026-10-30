"use client";
import Link from "next/link";
import { useState } from "react";
import { StatusDot } from "@/components/ui/Status";
import { dueLabel } from "@/lib/dates";
import { tt, type Status, type TLang } from "@/lib/team-i18n";
import type { TicketRow } from "@/lib/data/home";

export function MyWorkCard({ lang, all, week, footer }: { lang: TLang; all: TicketRow[]; week: TicketRow[]; footer?: React.ReactNode }) {
  const [tab, setTab] = useState<"week" | "all">(week.length ? "week" : "all");
  const rows = (tab === "week" ? week : all).slice(0, 8);
  return (
    <div className="card">
      <div className="card-h">
        <h2>{tt(lang, "myWork")}</h2>
        <div style={{ display: "flex", gap: ".375rem" }} role="tablist">
          <button type="button" role="tab" className="pill-s" aria-selected={tab === "week"} onClick={() => setTab("week")}>{tt(lang, "dueThisWeek")}</button>
          <button type="button" role="tab" className="pill-s" aria-selected={tab === "all"} onClick={() => setTab("all")}>{tt(lang, "allAssigned")}</button>
        </div>
      </div>
      {rows.length ? rows.map((t) => {
        const d = dueLabel(lang, t.due_on);
        return (
          <Link key={t.id} href={`/team/tickets/${t.key}`} className="row row-work">
            <StatusDot s={t.status} />
            <span className="key">{t.key}</span>
            <span className="stack-t"><span className="ell">{t.title}</span><span className="s">{t.project?.name ?? ""}</span></span>
            <span className={`chip${t.status === "in_progress" ? " attn" : ""}`}>{tt(lang, t.status as Status)}</span>
            <span className={`due ${d.cls}`}>{d.text}</span>
          </Link>
        );
      }) : <div className="card-f">{tt(lang, "nothingAssigned")}</div>}
      {footer ? <div className="card-f">{footer}</div> : null}
    </div>
  );
}
