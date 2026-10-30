"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { renderIssue, saveIssue, sendIssue, sendTest } from "@/app/actions/newsletter";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";
import { Editor, type Doc } from "./Editor";

type Issue = { id: string; number: number | null; title: string; subject_ar: string; subject_en: string; body_ar: Doc | null; body_en: Doc | null; segment: "ar" | "en" | "both"; status: string };

export function Composer({ lang, issue, audience, lastStats, broadcastsOn }: { lang: TLang; issue: Issue; audience: { ar: number; en: number }; lastStats: string; broadcastsOn: boolean }) {
  const [tab, setTab] = useState<"ar" | "en">("ar");
  const [subj, setSubj] = useState({ ar: issue.subject_ar, en: issue.subject_en });
  const [body, setBody] = useState({ ar: issue.body_ar, en: issue.body_en });
  const [html, setHtml] = useState("");
  const [when, setWhen] = useState("");
  const [showWhen, setShowWhen] = useState(false);
  const [segment, setSegment] = useState(issue.segment);
  const [pending, start] = useTransition();
  const toast = useToast();
  const saveT = useRef<ReturnType<typeof setTimeout>>(undefined), prevT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draft = issue.status === "draft";

  useEffect(() => {
    clearTimeout(prevT.current);
    prevT.current = setTimeout(() => { renderIssue({ lang: tab, title: subj[tab] || issue.title, body: body[tab] }).then(setHtml); }, 250);
  }, [tab, body, subj, issue.title]);
  const persist = (p: Parameters<typeof saveIssue>[1]) => { if (!draft) return; clearTimeout(saveT.current); saveT.current = setTimeout(() => saveIssue(issue.id, p), 600); };
  const err = (e: unknown) => toast((e as Error).message);

  return (
    <>
      <header className="ph">
        <div className="ph-t"><span className="eb">{tt(lang, "newsletter")} / {lang === "ar" ? "العدد" : "Issue"} {issue.number} · {issue.status}</span>
          <input className="inline-title" style={{ font: "300 2.5rem/1.1 var(--f-display)" }} defaultValue={issue.title} aria-label={lang === "ar" ? "عنوان العدد" : "Issue title"} disabled={!draft} onBlur={(e) => persist({ title: e.target.value })} /></div>
        <div className="ph-actions">
          <button type="button" className="b quiet" disabled={pending} onClick={() => start(async () => { try { const to = await sendTest(issue.id, tab); toast(lang === "ar" ? `انرسلت تجربة إلى ${to}` : `Test sent to ${to}`); } catch (e) { err(e); } })}>{tt(lang, "sendTest")}</button>
          {draft ? <>
            {showWhen ? <input type="datetime-local" className="inp" style={{ width: "auto" }} value={when} onChange={(e) => setWhen(e.target.value)} aria-label={tt(lang, "schedule")} autoFocus /> : <button type="button" className="b ghost" onClick={() => setShowWhen(true)}>{tt(lang, "schedule")}…</button>}
            <button type="button" className="b" disabled={pending || !broadcastsOn} title={broadcastsOn ? undefined : lang === "ar" ? "مقفل لين يرفع المالك مفتاح الأمان" : "Off until the owner lifts the email safety switch"} onClick={() => { if (confirm(lang === "ar" ? "ترسل العدد للمشتركين الحين؟" : `Send to ${segment === "both" ? "everyone" : segment === "ar" ? "Arabic subscribers" : "English subscribers"}?`)) start(async () => { try { await sendIssue(issue.id, { segment, scheduledAt: when ? new Date(when).toISOString() : null }); toast(tt(lang, "saved")); } catch (e) { err(e); } }); }}>{when ? tt(lang, "schedule") : tt(lang, "sendNow")}</button>
          </> : null}
        </div>
      </header>
      <div className="card sq" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem 1.5rem", padding: ".875rem 1rem", fontSize: ".8125rem", alignItems: "center" }}>
        <label>{tt(lang, "segment")} <select className="inp" style={{ width: "auto", padding: ".125rem .375rem" }} value={segment} onChange={(e) => { const s = e.target.value as Issue["segment"]; setSegment(s); persist({ segment: s }); }} disabled={!draft}>
          <option value="ar">{lang === "ar" ? "المشتركون بالعربي" : "Arabic subscribers"} · {audience.ar.toLocaleString("en")}</option>
          <option value="en">{lang === "ar" ? "المشتركون بالإنجليزي" : "English subscribers"} · {audience.en.toLocaleString("en")}</option>
          <option value="both">{tt(lang, "both")} · {(audience.ar + audience.en).toLocaleString("en")}</option></select></label>
        <span>{lang === "ar" ? "من" : "From"} <b style={{ fontWeight: 500 }}>Suhail &lt;hello@&gt;</b></span>
        {lastStats ? <span>{lang === "ar" ? "العدد السابق:" : "Last issue:"} <b style={{ fontWeight: 500 }}>{lastStats}</b></span> : null}
        <span className="muted" style={{ marginInlineStart: "auto" }}>{lang === "ar" ? "تأكيد مزدوج مفعّل · يمشي عبر Resend" : "Double opt-in on · sent through Resend"}</span>
      </div>
      <div className="grid-2" style={{ alignItems: "start", gap: "1.5rem" }}>
        <div className="col" style={{ gap: ".75rem" }}>
          <div className="seg2" role="group" aria-label={tt(lang, "language2")} style={{ alignSelf: "flex-start" }}>
            <button type="button" aria-pressed={tab === "ar"} onClick={() => setTab("ar")} lang="ar">العربية</button>
            <button type="button" aria-pressed={tab === "en"} onClick={() => setTab("en")} lang="en">English</button>
          </div>
          <label className="fld"><span>{tt(lang, "subject")} ({tab === "ar" ? tt(lang, "arabic") : tt(lang, "english")})</span>
            <input dir={tab === "ar" ? "rtl" : "ltr"} lang={tab} value={subj[tab]} disabled={!draft} onChange={(e) => { const s = { ...subj, [tab]: e.target.value }; setSubj(s); persist({ subject_ar: s.ar, subject_en: s.en }); }} /></label>
          <div key={tab} lang={tab} className={tab === "ar" ? "nl-ar" : "nl-en"}>
            <Editor value={body[tab]} dir={tab === "ar" ? "rtl" : "ltr"} label={tab === "ar" ? "النص بالعربي" : "English text"} placeholder={tab === "ar" ? "اكتب العدد بالعربي. / للأوامر" : "Write the English issue. / for blocks"}
              onChange={(d) => { const b = { ...body, [tab]: d }; setBody(b); persist(tab === "ar" ? { body_ar: d as never } : { body_en: d as never }); }} />
          </div>
        </div>
        <div className="col" style={{ gap: ".75rem" }}>
          <span className="eb">{lang === "ar" ? "معاينة الإيميل" : "Email preview"}</span>
          <div className="card soft" style={{ padding: "1.25rem" }}><iframe title={lang === "ar" ? "معاينة الإيميل" : "Email preview"} srcDoc={html} style={{ width: "100%", height: "34rem", border: 0, background: "var(--bg)" }} /></div>
        </div>
      </div>
    </>
  );
}
