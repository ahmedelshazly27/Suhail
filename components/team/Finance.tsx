"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideExpense, submitExpense } from "@/app/actions/workspace";
import { useToast } from "@/components/ui/Toast";
import { todayISO } from "@/lib/dates";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";
import type { Person, ProjectLite } from "@/lib/data/shell";

export type Exp = { id: string; description: string; amount: number; currency: string; status: string; spent_on: string; project_id: string | null; created_by: string | null; receipt_url: string | null; receipt_path: string | null; receiptSigned?: string | null };
export type Budget = { id: string; name: string; budget: number; currency: string; spent: number; note: string };

export function Finance({ lang, budgets, expenses, people, projects, categories, canDecide }: { lang: TLang; budgets: Budget[]; expenses: Exp[]; people: Person[]; projects: ProjectLite[]; categories: { key: string; name: string }[]; canDecide: boolean }) {
  const [filter, setFilter] = useState<"pending" | "all">(expenses.some((e) => e.status === "pending") ? "pending" : "all");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter(), toast = useToast();
  const rows = expenses.filter((e) => filter === "all" || e.status === "pending");
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  const dot = (s: string) => ({ approved: "var(--st-done)", paid: "var(--st-review)", rejected: "var(--st-danger)", pending: "var(--st-progress)" })[s];
  const decide = (id: string, s: "approved" | "rejected" | "paid") => start(async () => { try { await decideExpense(id, s); toast(tt(lang, s)); router.refresh(); } catch (e) { toast((e as Error).message); } });
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">{lang === "ar" ? "المالية" : "Finance"}</span><h1>{tt(lang, "finance")}</h1></div><button type="button" className="b" onClick={() => setOpen(true)}>{tt(lang, "submitExpense")}</button></header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))", gap: "1.25rem" }}>
        {budgets.map((b) => { const pct = b.budget ? Math.round((b.spent / b.budget) * 100) : 0; return (
          <div key={b.id} className="card pad">
            <h2>{b.name}</h2>
            <span><span className="num" style={{ font: "300 1.625rem/1 var(--f-display)" }}>{b.spent.toLocaleString("en")}</span> <span className="muted" style={{ fontSize: ".75rem" }}>{b.budget ? `${tt(lang, "of")} ${b.currency} ${b.budget.toLocaleString("en")}` : `${b.currency} ${tt(lang, "spent")}`}</span></span>
            <span className={`track${pct >= 80 ? " warn" : " ink"}`}><span style={{ width: Math.min(100, pct) + "%" }} /></span>
            <span className="muted" style={{ fontSize: ".75rem" }}>{b.note}</span>
          </div>); })}
      </div>
      <div className="card">
        <div className="card-h"><h2>{lang === "ar" ? "المصاريف" : "Expenses"}</h2>
          <div style={{ display: "flex", gap: ".375rem" }}><button type="button" className="pill-s" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>{lang === "ar" ? "بانتظار الاعتماد" : "Waiting for approval"} {expenses.filter((e) => e.status === "pending").length}</button><button type="button" className="pill-s" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{tt(lang, "allRoles")}</button></div></div>
        <div className="tbl-wrap"><table className="tbl" style={{ margin: "0 1.125rem", width: "calc(100% - 2.25rem)" }}>
          <thead><tr><th>{tt(lang, "when")}</th><th>{lang === "ar" ? "الوصف" : "What"}</th><th>{tt(lang, "project")}</th><th>{lang === "ar" ? "من" : "By"}</th><th className="n">{tt(lang, "amount")}</th><th>{tt(lang, "receipt")}</th><th>{tt(lang, "status")}</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id} style={{ cursor: "default" }}>
              <td className="key">{fmt(e.spent_on)}</td><td>{e.description}</td><td>{projects.find((p) => p.id === e.project_id)?.name ?? (lang === "ar" ? "العمليات" : "Operations")}</td>
              <td>{people.find((p) => p.id === e.created_by)?.name.split(" ")[0]}</td><td className="n">{e.currency} {Number(e.amount).toLocaleString("en")}</td>
              <td>{e.receiptSigned || e.receipt_url ? <a href={(e.receiptSigned || e.receipt_url)!} target="_blank" rel="noreferrer">{lang === "ar" ? "افتح" : "Open"}</a> : <span style={{ color: "var(--st-danger)" }}>{lang === "ar" ? "ناقص" : "Missing"}</span>}</td>
              <td>{e.status === "pending" && canDecide ? (
                <span style={{ display: "flex", gap: ".375rem" }}><button type="button" className="b" style={{ padding: ".25rem .625rem" }} disabled={pending} onClick={() => decide(e.id, "approved")}>{tt(lang, "approve")}</button><button type="button" className="b quiet" style={{ padding: ".25rem .625rem" }} disabled={pending} onClick={() => decide(e.id, "rejected")}>{tt(lang, "reject")}</button></span>
              ) : e.status === "approved" && canDecide ? (
                <span style={{ display: "flex", gap: ".5rem", alignItems: "center" }}><span className="dot" style={{ background: dot(e.status) }} />{tt(lang, "approved")}<button type="button" className="linkbtn" onClick={() => decide(e.id, "paid")}>{lang === "ar" ? "انصرف" : "Mark paid"}</button></span>
              ) : <span style={{ display: "inline-flex", gap: ".375rem", alignItems: "center" }}><span className="dot" style={{ background: dot(e.status) }} />{tt(lang, e.status as TKey)}</span>}</td>
            </tr>))}</tbody>
        </table></div>
        {!rows.length ? <div className="card-f">{tt(lang, "emptyList")}</div> : null}
      </div>
      <p className="muted" style={{ fontSize: ".78rem" }}>{lang === "ar" ? "طلبات الاعتماد توصل كبطاقات Teams لمسؤول المالية. الإيصالات تنحفظ في SharePoint، مجلد Finance." : "Approvals also arrive as Teams cards for the Finance Lead. Receipts are stored in SharePoint, Suhail Finance."}</p>
      {open ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="ex-h" action={(f) => start(async () => { try { await submitExpense(f); setOpen(false); toast(tt(lang, "saved")); router.refresh(); } catch (e) { toast((e as Error).message); } })}>
            <div style={{ display: "flex", alignItems: "center" }}><h2 id="ex-h">{tt(lang, "submitExpense")}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={() => setOpen(false)}>×</button></div>
            <label className="fld"><span>{lang === "ar" ? "الوصف" : "What"}</span><input name="description" required autoFocus /></label>
            <div className="grid-2" style={{ gap: ".75rem" }}>
              <label className="fld"><span>{tt(lang, "amount")}</span><input name="amount" type="number" step="0.001" min="0.001" required inputMode="decimal" /></label>
              <label className="fld"><span>{lang === "ar" ? "العملة" : "Currency"}</span><select name="currency" defaultValue="KWD">{["KWD", "SAR", "AED", "QAR", "BHD", "OMR", "EGP", "USD"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="fld"><span>{tt(lang, "project")}</span><select name="project_id" defaultValue=""><option value="">{lang === "ar" ? "العمليات" : "Operations"}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="fld"><span>{lang === "ar" ? "الفئة" : "Category"}</span><select name="category" defaultValue="">{[<option key="" value="">–</option>, ...categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)]}</select></label>
              <label className="fld"><span>{tt(lang, "when")}</span><input name="spent_on" type="date" defaultValue={todayISO()} required /></label>
            </div>
            <div className="fld"><span id="rc-l">{tt(lang, "receipt")}</span><div className="filepick"><input id="rc" name="receipt" type="file" accept="application/pdf,image/*" capture="environment" aria-labelledby="rc-l" /><label htmlFor="rc" className="pill-s" style={{ color: "var(--fg)" }}>{lang === "ar" ? "اختر ملف أو صوّر" : "Choose file or take a photo"}</label></div></div>
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}><button type="button" className="b quiet" onClick={() => setOpen(false)}>{tt(lang, "cancel")}</button><button className="b" type="submit" disabled={pending}>{tt(lang, "submitExpense")}</button></div>
          </form>
        </div>
      ) : null}
    </>
  );
}
