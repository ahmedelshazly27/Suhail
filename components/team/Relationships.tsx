"use client";
import { Md } from "@/components/ui/Md";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addRelationshipEvent, saveRelationship } from "@/app/actions/workspace";
import { emailRelationship } from "@/app/actions/outreach";
import { Peek } from "@/components/ui/Peek";
import { useToast } from "@/components/ui/Toast";
import { ago, dueLabel, todayISO } from "@/lib/dates";
import { tt, type TLang } from "@/lib/team-i18n";
import { Board } from "./Board";
import type { Person, ProjectLite } from "@/lib/data/shell";

export type Rel = { id: string; name: string; type: string; stage: string; owner_id: string | null; next_step: string; next_due: string | null; project_ids: string[]; value: number | null; last_contact_at: string | null; last_contact_via: string | null; contact?: { name: string; email: string | null } | null; events: { what: string; via: string; happened_at: string }[] };
const STAGES = ["Prospect", "Contacted", "In talks", "Confirmed", "Active", "Past"];
const TYPES = ["Sponsor", "Partner", "Speaker", "Podcast guest", "Venue", "Judge"];
const PLURAL: Record<string, [string, string]> = { Sponsor: ["Sponsors", "رعاة"], Partner: ["Partners", "شركاء"], Speaker: ["Speakers", "متحدثون"], "Podcast guest": ["Podcast guests", "ضيوف البودكاست"], Venue: ["Venues", "أماكن"], Judge: ["Judges", "حكّام"] };
const stageDot = (s: string) => ({ Prospect: "var(--st-todo)", Contacted: "var(--muted)", "In talks": "var(--st-progress)", Confirmed: "var(--st-review)", Active: "var(--st-done)", Past: "var(--faint)" })[s];

/** The newest first email an agent drafted for this relationship and nobody has sent yet, to start the composer. */
function agentDraft(r: Rel) {
  const e = r.events.find((x) => x.via.startsWith("email-draft"));
  const m = e && /^First email, ready to send: \*\*(.+?)\*\*\n\n([\s\S]*)$/.exec(e.what);
  return m ? { subject: m[1], body: m[2] } : null;
}

function EmailDialog({ lang, r, signature, onClose }: { lang: TLang; r: Rel; signature: string; onClose: () => void }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const draft = agentDraft(r);
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const go = (f: HTMLFormElement, send: boolean) => {
    const d = new FormData(f);
    start(async () => {
      try {
        const res = await emailRelationship({ relationship_id: r.id, to: String(d.get("to")), subject: String(d.get("subject")), body: String(d.get("body")), send });
        toast(send ? L("Sent from your Outlook.", "انرسل من Outlook حقك.") : L("Saved in your Outlook Drafts.", "انحفظ في مسودات Outlook."));
        if (!send && res.webLink) window.open(res.webLink, "_blank", "noopener");
        onClose(); router.refresh();
      } catch (e) { toast((e as Error).message || tt(lang, "error")); }
    });
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="em-h" onSubmit={(e) => { e.preventDefault(); go(e.currentTarget, false); }}>
        <div style={{ display: "flex", alignItems: "center" }}><h2 id="em-h">{L(`Email ${r.name}`, `إيميل إلى ${r.name}`)}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={onClose}>×</button></div>
        <label className="fld"><span>{L("To", "إلى")}</span><input name="to" type="email" required dir="ltr" defaultValue={r.contact?.email ?? ""} autoFocus={!r.contact?.email} /></label>
        <label className="fld"><span>{L("Subject", "الموضوع")}</span><input name="subject" required maxLength={200} dir="auto" defaultValue={draft?.subject ?? ""} /></label>
        <label className="fld"><span>{L("Message", "الرسالة")}</span><textarea name="body" required rows={10} dir="auto" defaultValue={draft?.body ?? ""} />
          {draft ? <span className="help">{L("Started from the draft an agent wrote. Edit anything.", "بدأنا من مسودة كتبها وكيل. عدّل اللي تبي.")}</span> : null}</label>
        <div className="fld"><span>{L("Your signature, added automatically", "توقيعك، ينضاف تلقائي")}</span><pre className="sig-prev">{signature}</pre></div>
        <div className="row-btns">
          <button className="b" disabled={pending}>{L("Save to Outlook Drafts", "احفظه في مسودات Outlook")}</button>
          <button type="button" className="b quiet" disabled={pending} onClick={(e) => { const f = e.currentTarget.form!; if (f.reportValidity()) go(f, true); }}>{L("Send now", "أرسله الحين")}</button>
          <button type="button" className="b ghost" onClick={onClose}>{tt(lang, "cancel")}</button>
        </div>
      </form>
    </div>
  );
}

export function Relationships({ lang, rows, people, projects, signature = "", canEmail = false }: { lang: TLang; rows: Rel[]; people: Person[]; projects: ProjectLite[]; signature?: string; canEmail?: boolean }) {
  const sp = useSearchParams(), path = usePathname(), router = useRouter(), toast = useToast();
  const [layout, setLayout] = useState<"table" | "board">("table");
  const [type, setType] = useState<string>("all");
  const [, start] = useTransition();
  const [emailing, setEmailing] = useState(false);
  const id = sp.get("id");
  const today = todayISO();
  const overdue = (r: Rel) => !!r.next_due && r.next_due < today && r.stage !== "Past";
  const shown = useMemo(() => rows.filter((r) => (type === "all" ? true : type === "overdue" ? overdue(r) : r.type === type)), [rows, type]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = rows.find((r) => r.id === id);
  const who = (pid: string | null) => people.find((p) => p.id === pid)?.name.split(" ")[0] ?? (lang === "ar" ? "بدون مسؤول" : "Unassigned");
  const save = (rid: string, patch: Parameters<typeof saveRelationship>[1]) => start(async () => { await saveRelationship(rid, patch); router.refresh(); });
  const open = (rid: string) => router.push(`${path}?id=${rid}`, { scroll: false });
  return (
    <>
      <header className="ph">
        <div className="ph-t"><span className="eb">{lang === "ar" ? "شركاء، رعاة، متحدثون، ضيوف، أماكن" : "Partners, sponsors, speakers, guests, venues"}</span><h1>{tt(lang, "relationships")}</h1></div>
        <div className="ph-actions">
          <div className="seg2" role="group" aria-label="Layout">{(["table", "board"] as const).map((l) => <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}>{l === "table" ? tt(lang, "table") : lang === "ar" ? "المراحل" : "Pipeline"}</button>)}</div>
          <button type="button" className="b" onClick={() => start(async () => { const nid = await saveRelationship(null, { name: lang === "ar" ? "علاقة جديدة" : "New relationship" }); if (nid) open(nid); })}>{lang === "ar" ? "أضف" : "Add"}</button>
        </div>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
        <button type="button" className="pill-s" aria-pressed={type === "all"} onClick={() => setType("all")}>{tt(lang, "allRoles")} <span className="key">{rows.length}</span></button>
        {TYPES.filter((t) => rows.some((r) => r.type === t)).map((t) => <button key={t} type="button" className="pill-s" aria-pressed={type === t} onClick={() => setType(t)}>{PLURAL[t][lang === "ar" ? 1 : 0]} <span className="key">{rows.filter((r) => r.type === t).length}</span></button>)}
        {rows.some(overdue) ? <button type="button" className="pill-s" aria-pressed={type === "overdue"} onClick={() => setType("overdue")} style={{ color: "var(--accent-ink)", borderColor: type === "overdue" ? "var(--accent-ink)" : undefined }}>{lang === "ar" ? "خطوات متأخرة" : "Next step overdue"} {rows.filter(overdue).length}</button> : null}
      </div>
      {layout === "table" ? (
        <div className="card"><div className="tbl-wrap" tabIndex={0}><table className="tbl" style={{ margin: "0 1rem", width: "calc(100% - 2rem)" }}>
          <thead><tr><th>{tt(lang, "name")}</th><th>{tt(lang, "type")}</th><th>{tt(lang, "stage")}</th><th>{tt(lang, "owner2")}</th><th>{tt(lang, "nextStep")}</th><th>{tt(lang, "lastContact")}</th></tr></thead>
          <tbody>{shown.map((r) => { const d = dueLabel(lang, r.next_due); return (
            <tr key={r.id} aria-selected={id === r.id} onClick={() => open(r.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(r.id)}>
              <td><span className="stack-t"><span style={{ fontWeight: 500 }}>{r.name}</span><span className="s">{projects.filter((p) => r.project_ids.includes(p.id)).map((p) => p.name).join(", ")}</span></span></td>
              <td>{r.type}</td><td><span className={`chip${r.stage === "In talks" ? " attn" : ""}`}><span className="dot" style={{ background: stageDot(r.stage) }} />{r.stage}</span></td><td>{who(r.owner_id)}</td>
              <td><span className="stack-t"><span className="ell">{r.next_step}</span><span className={`due ${d.cls}`}>{d.text}</span></span></td>
              <td className="muted">{r.last_contact_at ? `${r.last_contact_via ?? ""} · ${ago(lang, r.last_contact_at)}` : lang === "ar" ? "أبدًا" : "Never"}</td>
            </tr>); })}</tbody>
        </table></div></div>
      ) : (
        <Board cols={STAGES.map((s) => ({ id: s, title: s, dot: <span className="dot" style={{ background: stageDot(s) }} />, items: shown.filter((r) => r.stage === s) }))} label={tt(lang, "relationships")}
          onMove={(rid, stage) => save(rid, { stage: stage as "Prospect" })}
          render={(r, dragging) => { const d = dueLabel(lang, r.next_due); return <button type="button" className={`bcard${dragging ? " dragging" : ""}`} onClick={() => open(r.id)}><span className="ttl" style={{ fontWeight: 500 }}>{r.name}</span><span className="muted" style={{ fontSize: ".75rem" }}>{r.type} · {who(r.owner_id)}</span><span className="meta"><span className="ell" style={{ fontSize: ".75rem" }}>{r.next_step}</span><span className={`due ${d.cls}`}>{d.text}</span></span></button>; }} />
      )}
      {cur ? (
        <Peek lang={lang} onClose={() => router.push(path, { scroll: false })} fullHref={`${path}?id=${cur.id}`} crumb={cur.type}>
          <input className="inline-title" defaultValue={cur.name} aria-label={tt(lang, "name")} onBlur={(e) => e.target.value.trim() && e.target.value !== cur.name && save(cur.id, { name: e.target.value.trim() })} />
          <dl className="props">
            <dt>{tt(lang, "stage")}</dt><dd><select value={cur.stage} onChange={(e) => save(cur.id, { stage: e.target.value as "Prospect" })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></dd>
            <dt>{tt(lang, "type")}</dt><dd><select value={cur.type} onChange={(e) => save(cur.id, { type: e.target.value })}>{TYPES.map((s) => <option key={s}>{s}</option>)}</select></dd>
            <dt>{lang === "ar" ? "القيمة" : "Value"}</dt><dd><input type="number" min={0} defaultValue={cur.value ?? ""} placeholder="KWD" onBlur={(e) => save(cur.id, { value: e.target.value ? Number(e.target.value) : null })} /></dd>
            <dt>{tt(lang, "owner2")}</dt><dd><select value={cur.owner_id ?? ""} onChange={(e) => save(cur.id, { owner_id: e.target.value || null })}><option value="">{tt(lang, "unassigned")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></dd>
            <dt>{tt(lang, "project")}</dt><dd style={{ flexWrap: "wrap" }}>{projects.filter((p) => cur.project_ids.includes(p.id)).map((p) => <Link key={p.id} href={`/team/projects/${p.slug}`}>{p.name}</Link>)}
              <select className="chip-add" value="" aria-label={tt(lang, "project")} onChange={(e) => e.target.value && save(cur.id, { project_ids: [...cur.project_ids, e.target.value] })}><option value="">+</option>{projects.filter((p) => !cur.project_ids.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></dd>
          </dl>
          <div className="rel-contact">
            <span className="stack-t"><span>{cur.contact?.name ?? (lang === "ar" ? "ما فيه شخص مرتبط" : "No contact yet")}</span><span className="s" dir="ltr">{cur.contact?.email ?? (lang === "ar" ? "ما فيه إيميل" : "No email yet")}</span></span>
            <button type="button" className="b" disabled={!canEmail} title={canEmail ? undefined : lang === "ar" ? "يشتغل بعد ربط Microsoft 365" : "Works once Microsoft 365 is connected"} onClick={() => setEmailing(true)}>{lang === "ar" ? "إيميل" : "Email"}{agentDraft(cur) ? (lang === "ar" ? " · مسودة جاهزة" : " · draft ready") : ""}</button>
          </div>
          <div style={{ border: "1px solid var(--fg)", padding: ".875rem 1rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
            <span className="sect-h" style={{ border: 0, padding: 0 }}>{tt(lang, "nextStep")} · <input type="date" defaultValue={cur.next_due ?? ""} aria-label={tt(lang, "due")} style={{ border: 0, background: "transparent", font: "inherit", color: "inherit" }} onChange={(e) => save(cur.id, { next_due: e.target.value || null })} /></span>
            <textarea className="inline-title" style={{ font: "400 .875rem/1.5 var(--f-body)" }} rows={2} defaultValue={cur.next_step} aria-label={tt(lang, "nextStep")} onBlur={(e) => e.target.value !== cur.next_step && save(cur.id, { next_step: e.target.value })} />
          </div>
          <div className="sect-h">{lang === "ar" ? "الخط الزمني · من Outlook وTeams" : "Timeline · pulled from Outlook and Teams"}</div>
          <div className="feed">{cur.events.map((e, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "3.5rem minmax(0,1fr)", gap: ".75rem" }}><span className="key">{dueLabel(lang, e.happened_at.slice(0, 10)).text}</span><span className="stack-t"><Md text={e.what} className="md md-sm" /><span className="s">{e.via}</span></span></div>
          ))}</div>
          <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = String(new FormData(f).get("note") || "").trim(); if (v) start(async () => { await addRelationshipEvent(cur.id, v); f.reset(); toast(tt(lang, "saved")); router.refresh(); }); }}>
            <input name="note" className="inp" placeholder={lang === "ar" ? "أضف ملاحظة للخط الزمني" : "Add a note to the timeline"} aria-label={lang === "ar" ? "ملاحظة" : "Note"} />
          </form>
        </Peek>
      ) : null}
      {cur && emailing ? <EmailDialog lang={lang} r={cur} signature={signature} onClose={() => setEmailing(false)} /> : null}
    </>
  );
}
