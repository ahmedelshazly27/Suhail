"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNote, assignApplications, emailApplicants, moveStage, previewTemplate, scoreApplication, type loadApplication } from "@/app/actions/applications";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { ago } from "@/lib/dates";
import { resolveOpts } from "@/lib/forms";
import { stageLabel, tt, type TLang } from "@/lib/team-i18n";
import { Feed } from "./Feed";
import type { Person } from "@/lib/data/shell";

type Data = NonNullable<Awaited<ReturnType<typeof loadApplication>>>;
const words = (s: string) => (s.trim().match(/\S+/g) || []).length;

function Dots({ value, onPick, label }: { value: number; onPick?: (n: number) => void; label: string }) {
  return (
    <span role={onPick ? "radiogroup" : "img"} aria-label={`${label}: ${value || 0} / 5`} style={{ display: "inline-flex", gap: 2, letterSpacing: 0 }}>
      {[1, 2, 3, 4, 5].map((n) => onPick ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={String(n)} onClick={() => onPick(n)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: ".8rem", lineHeight: 1 }}>{n <= value ? "●" : "○"}</button>
      ) : <span key={n} style={{ fontSize: ".8rem" }}>{n <= Math.round(value) ? "●" : "○"}</span>)}
    </span>
  );
}

/** Everything about one applicant: answers (the role's task highlighted), CV, rubric, notes, emails and activity. */
export function ApplicantDetail({ data, lang, people, templates, onChanged }: { data: Data; lang: TLang; people: Person[]; templates: { key: string; name: string }[]; onChanged?: () => void }) {
  const { app: a, role, form, fields } = data;
  const [, start] = useTransition();
  const [preview, setPreview] = useState<{ key: string; to: string; subject: string; html: string } | null>(null);
  const router = useRouter();
  const toast = useToast();
  const refresh = () => (onChanged ? onChanged() : router.refresh());
  const stages = form.stages;
  const next = stages[stages.indexOf(a.stage) + 1];
  const ans = a.answers as Record<string, string | string[]>;
  const label = (id: string, v: string) => resolveOpts(fields.find((f) => f.id === id)!)?.find((o) => o[0] === v)?.[lang === "ar" ? 2 : 1] ?? v;
  const show = (f: (typeof fields)[number]) => { const v = ans[f.id]; if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null; return Array.isArray(v) ? v.map((x) => label(f.id, x)).join(", ") : ["radio", "select"].includes(f.type) ? label(f.id, v) : v; };
  const task = fields.filter((f) => f.task && show(f));
  const rubric = role?.rubric ?? [];
  const links = fields.filter((f) => f.ltr && typeof ans[f.id] === "string" && /^(https?:\/\/|[\w.-]+\.[a-z]{2,}\/)/i.test(String(ans[f.id])));

  return (
    <>
      <div style={{ display: "flex", gap: ".875rem", alignItems: "center" }}>
        <Avatar name={a.name || a.email} size="lg" />
        <div className="stack-t"><h1 style={{ margin: 0, font: "300 1.625rem/1.2 var(--f-display)" }}>{a.name || a.email}</h1>
          <span className="muted" style={{ fontSize: ".8125rem" }}>{[ans.country && label("country", String(ans.country)), `${lang === "ar" ? "قدّم" : "applied"} ${ago(lang, a.created_at)}`, a.lang === "ar" ? tt(lang, "arabic") : tt(lang, "english")].filter(Boolean).join(" · ")}</span></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
        <label className="b quiet" style={{ gap: ".375rem" }}>{tt(lang, "stage")}:
          <select value={a.stage} onChange={(e) => start(async () => { await moveStage({ ids: [a.id], stage: e.target.value }); refresh(); })} style={{ border: 0, background: "transparent", appearance: "none" }} aria-label={tt(lang, "stage")}>{stages.map((s) => <option key={s} value={s}>{stageLabel(lang, s)}</option>)}</select></label>
        <label className="b quiet" style={{ gap: ".375rem" }}>{lang === "ar" ? "المراجع" : "Reviewer"}:
          <select value={a.assignee_id ?? ""} onChange={(e) => start(async () => { await assignApplications({ ids: [a.id], assignee: e.target.value || null }); refresh(); })} style={{ border: 0, background: "transparent", appearance: "none" }} aria-label={lang === "ar" ? "المراجع" : "Reviewer"}>
            <option value="">{tt(lang, "unassigned")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name.split(" ")[0]}</option>)}</select></label>
        {data.cvSigned ? <a className="b quiet" href={data.cvSigned} target="_blank" rel="noreferrer">CV (PDF)</a> : null}
        {a.cv_url ? <a className="b quiet" href={/^https?:/.test(a.cv_url) ? a.cv_url : `https://${a.cv_url}`} target="_blank" rel="noreferrer">{tt(lang, "cvLink")}</a> : null}
        {links.map((f) => <a key={f.id} className="b quiet" href={/^https?:/.test(String(ans[f.id])) ? String(ans[f.id]) : `https://${ans[f.id]}`} target="_blank" rel="noreferrer">{f.en}</a>)}
      </div>
      {data.dupes.length ? <p className="chip attn" style={{ alignSelf: "flex-start" }}>{tt(lang, "duplicate")}: {data.dupes.map((d) => `${d.form_key} (${d.stage})`).join(", ")}</p> : null}

      {task.length ? (
        <div style={{ borderInlineStart: "2px solid var(--fg)", background: "var(--soft)", padding: ".875rem 1rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
          <div className="sect-h" style={{ border: 0, padding: 0 }}>{lang === "ar" ? "مهمتهم" : "Their task"}{role ? ` · ${lang === "ar" ? role.plain_ar : role.plain_en}` : ""}</div>
          {task.map((f) => (
            <div key={f.id}><div className="muted" style={{ fontSize: ".78rem" }}>{lang === "ar" ? f.ar : f.en}</div>
              <p style={{ margin: ".25rem 0 0", whiteSpace: "pre-wrap", fontSize: ".875rem" }} dir="auto">{show(f)}</p>
              {f.max && typeof ans[f.id] === "string" ? <span className="muted" style={{ fontSize: ".75rem" }}>{words(String(ans[f.id]))} {tt(lang, "of")} {f.max} {lang === "ar" ? "كلمة" : "words"}</span> : null}</div>
          ))}
        </div>
      ) : null}

      {rubric.length ? (
        <div><div className="sect-h">{lang === "ar" ? "تقييمك" : "Your score"}</div>
          {rubric.map((c) => (
            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".3rem 0", fontSize: ".84375rem" }}>
              <span>{c.en}</span>
              <span style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>{data.avgScores[c.key] ? <span className="muted key">{lang === "ar" ? "المتوسط" : "avg"} {data.avgScores[c.key].toFixed(1)}</span> : null}
                <Dots value={data.myScores[c.key] ?? 0} label={c.en} onPick={(n) => start(async () => { await scoreApplication({ id: a.id, criterion: c.key, score: n }); refresh(); })} /></span>
            </div>
          ))}
        </div>
      ) : null}

      <div><div className="sect-h">{tt(lang, "answers")}</div>
        <dl className="props" style={{ gridTemplateColumns: "minmax(0,11rem) minmax(0,1fr)", alignItems: "start" }}>
          {fields.filter((f) => !f.task && show(f) && f.type !== "file").map((f) => [<dt key={f.id + "t"}>{lang === "ar" ? f.ar : f.en}</dt>, <dd key={f.id + "d"} style={{ whiteSpace: "pre-wrap", display: "block" }} dir="auto">{show(f)}</dd>])}
        </dl>
      </div>
      {data.cvSigned ? <iframe title="CV" src={data.cvSigned} style={{ width: "100%", height: "28rem", border: "1px solid var(--line)" }} /> : null}

      <div className="sect-h">{tt(lang, "notes")}</div>
      <Feed lang={lang} items={data.feed} people={people} entity={{ type: "application", id: a.id }} placeholder={tt(lang, "notePh")} onPosted={refresh} onSend={async (body) => { await addNote({ id: a.id, body }); }} />
      {data.emails.length ? <div className="feed">{data.emails.map((e) => <div key={e.id} className="ev">✉ {e.subject} · {e.status} · {ago(lang, e.created_at)}</div>)}</div> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: "auto", paddingTop: ".5rem" }}>
        {next && next !== "Not now" ? <button type="button" className="b" onClick={() => start(async () => { await moveStage({ ids: [a.id], stage: next }); refresh(); })}>{lang === "ar" ? `انقل إلى ${stageLabel(lang, next)}` : `Move to ${next}`}</button> : null}
        <label className="b ghost" style={{ gap: ".375rem" }}>{lang === "ar" ? "إيميل من قالب" : "Email from template"}
          <select value="" aria-label={tt(lang, "template")} style={{ border: 0, background: "transparent", appearance: "none", width: "1rem" }} onChange={(e) => { const key = e.target.value; if (key) start(async () => setPreview({ key, ...(await previewTemplate({ id: a.id, key })) })); }}>
            <option value="">▾</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></label>
        {stages.includes("Not now") && a.stage !== "Not now" ? <button type="button" className="b quiet" onClick={() => start(async () => { await moveStage({ ids: [a.id], stage: "Not now" }); refresh(); })}>{lang === "ar" ? "مو الحين" : "Not now"}</button> : null}
      </div>

      {preview ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="pv-h" style={{ width: "min(40rem, 100%)" }}>
            <div style={{ display: "flex", alignItems: "center" }}><h2 id="pv-h">{tt(lang, "preview")}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={() => setPreview(null)}>×</button></div>
            <p className="muted" style={{ fontSize: ".8125rem" }}>{lang === "ar" ? "إلى" : "To"}: {preview.to} · {preview.subject}</p>
            <iframe title={tt(lang, "preview")} srcDoc={preview.html} style={{ width: "100%", height: "22rem", border: "1px solid var(--line)", background: "white" }} />{/* ds-allow: email preview canvas */}
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
              <button type="button" className="b quiet" onClick={() => setPreview(null)}>{tt(lang, "cancel")}</button>
              <button type="button" className="b" onClick={() => start(async () => { await emailApplicants({ ids: [a.id], key: preview.key }); setPreview(null); toast(tt(lang, "emailSent")); refresh(); })}>{tt(lang, "sendEmail")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export { Dots };
