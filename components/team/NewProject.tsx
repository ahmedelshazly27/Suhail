"use client";
import { useState, useTransition } from "react";
import { createProject } from "@/app/actions/projects";
import { tt, type TLang } from "@/lib/team-i18n";
import type { Person } from "@/lib/data/shell";

export function NewProject({ lang, people, templates }: { lang: TLang; people: Person[]; templates: { key: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="b" onClick={() => setOpen(true)}>{tt(lang, "newProject")}</button>;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="np-h" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(() => createProject({
        name: String(f.get("name")), template_key: String(f.get("template")) || null, target_date: String(f.get("target")) || null, lead_id: String(f.get("lead")) || null, budget: f.get("budget") ? Number(f.get("budget")) : null, sharepoint: f.get("sp") === "on",
      })); }}>
        <div style={{ display: "flex", alignItems: "center" }}><h2 id="np-h">{tt(lang, "newProject")}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={() => setOpen(false)}>×</button></div>
        <label className="fld"><span>{tt(lang, "name")}</span><input name="name" required autoFocus /></label>
        <label className="fld"><span>{tt(lang, "fromTemplate")}</span><select name="template" defaultValue=""><option value="">{tt(lang, "blank")}</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></label>
        <div className="grid-2" style={{ gap: ".75rem" }}>
          <label className="fld"><span>{tt(lang, "target")}</span><input name="target" type="date" /></label>
          <label className="fld"><span>{tt(lang, "lead")}</span><select name="lead" defaultValue="">{[<option key="" value="">{lang === "ar" ? "أنا" : "Me"}</option>, ...people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)]}</select></label>
        </div>
        <label className="fld"><span>{tt(lang, "budget")} (KWD)</span><input name="budget" type="number" min={0} step="0.001" /></label>
        <label style={{ display: "flex", gap: ".5rem", fontSize: ".8125rem" }}><input type="checkbox" name="sp" defaultChecked />{lang === "ar" ? "أنشئ مجلد له في Projects على SharePoint" : "Create its folder in Projects/ on SharePoint"}</label>
        <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}><button type="button" className="b quiet" onClick={() => setOpen(false)}>{tt(lang, "cancel")}</button><button className="b" type="submit" disabled={pending}>{tt(lang, "create")}</button></div>
      </form>
    </div>
  );
}
