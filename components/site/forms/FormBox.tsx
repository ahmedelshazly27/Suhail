"use client";
// The prototype's form renderer (fieldInner / renderForm), in React. Same markup and classes, same checks and
// messages, then the same checks again on the server.
import { useMemo, useState } from "react";
import { cvUploadUrl, submitForm } from "@/app/actions/public";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { checkAnswers, flat, resolveOpts, words, type Answers, type Field, type Opt, type Row } from "@/lib/forms";
import { t, type Lang } from "@/lib/i18n";
import { problemText } from "./messages";
import { Turnstile, resetTurnstile } from "./Turnstile";

type Props = { formKey: string; action: string; rows: Row[]; submit: [string, string]; lang: Lang; hackathons?: Opt[]; preset?: Answers };

const wcText = (lang: Lang, n: number, max: number) => (lang === "ar" ? `${n} من ${max} كلمة` : `${n} / ${max} words`);

export function FormBox({ formKey, action, rows, submit, lang, hackathons = [], preset }: Props) {
  const [v, setV] = useState<Answers>(() => ({ ...(preset || {}) }));
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ text: string; err: boolean }>({ text: "", err: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const fields = useMemo(() => flat(rows), [rows]);
  const L = lang === "ar" ? 2 : 1;
  const set = (id: string, x: string | string[]) => setV((o) => ({ ...o, [id]: x }));
  const id = (f: Field) => `ff-${formKey}-${f.id}`;
  const hidden = (f: Field) => Boolean(f.when && f.when !== v.role);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = (k: string) => { setStatus({ text: problemText(lang, k), err: true }); return; };
    const hasCv = fields.some((f) => f.type === "file");
    const problem = checkAnswers(rows, v, { hackathons });
    if (problem) return err(problem);
    if (hasCv && !file && !v.cv_link) return err("cv_need");
    if (file && (file.size > 10 * 1024 * 1024 || !/pdf$/i.test(file.type || file.name))) return err("cv_bad");
    setBusy(true); setStatus({ text: t(lang, "saving"), err: false });
    try {
      let cvPath: string | null = null;
      if (file) {
        const up = await cvUploadUrl();
        if (!up.ok) { setBusy(false); return err(up.problem === "rate" ? "err" : "cv_noup"); }
        const { error } = await supabaseBrowser().storage.from("cvs").uploadToSignedUrl(up.path, up.token, file, { contentType: "application/pdf" });
        if (error) { setBusy(false); return err("cv_noup"); }
        cvPath = up.path;
      }
      const answers: Answers = {};
      fields.filter((f) => !hidden(f) && f.type !== "file").forEach((f) => { if (v[f.id] != null && v[f.id] !== "") answers[f.id] = v[f.id]; });
      const r = await submitForm({ form: action, lang, answers, cvPath, token });
      resetTurnstile();
      setBusy(false);
      if (!r.ok) return err(r.problem);
      setStatus({ text: "", err: false });
      setDone(String(v.email || ""));
    } catch {
      setBusy(false); err("err");
    }
  }

  const label = (f: Field) => (lang === "ar" ? f.ar : f.en) + (f.req ? " *" : "");
  const note = (f: Field) => (f.note ? <p className="fnote">{f.note[lang === "ar" ? 1 : 0]}</p> : null);

  function field(f: Field) {
    const key = id(f);
    if (f.type === "head") return <div className="field fhead" key={key}><span className="eyebrow">{lang === "ar" ? f.ar : f.en}</span><p className="muted">{t(lang, "task_p")}</p></div>;
    const wrap = (inner: React.ReactNode) => <div className="field" key={key} hidden={hidden(f)} data-when={f.when}>{inner}</div>;
    if (f.type === "file") return wrap(<>
      <span className="lbl" id={`${key}-l`}>{label(f)}</span>
      <div className="filerow">
        <input id={key} className="vh" type="file" accept={f.accept} aria-labelledby={`${key}-l`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label htmlFor={key} className="pill">{t(lang, "choose_file")}</label>
        <span className="fname">{file ? file.name : t(lang, "no_file")}</span>
      </div>
    </>);
    if (f.type === "text" || f.type === "email") return wrap(<>
      <label htmlFor={key}>{label(f)}</label>{note(f)}
      <input id={key} type={f.type} placeholder={f.ph} dir={f.type === "email" || f.ltr ? "ltr" : undefined}
        autoComplete={f.id === "email" ? "email" : f.id === "name" ? "name" : "off"} aria-required={f.req ? true : undefined}
        value={(v[f.id] as string) || ""} onChange={(e) => set(f.id, e.target.value)} />
    </>);
    if (f.type === "textarea") {
      const n = words((v[f.id] as string) || "");
      return wrap(<>
        <label htmlFor={key}>{label(f)}</label>{note(f)}
        <textarea id={key} placeholder={f.ph} dir={f.ltr ? "ltr" : undefined} rows={f.max ? Math.min(8, 2 + Math.round(f.max / 40)) : undefined}
          aria-required={f.req ? true : undefined} value={(v[f.id] as string) || ""} onChange={(e) => set(f.id, e.target.value)} />
        {f.max ? <span className={"wc" + (n > f.max ? " over" : "")} aria-live="polite">{wcText(lang, n, f.max)}</span> : null}
      </>);
    }
    const opts = resolveOpts(f, hackathons);
    if (f.type === "select") return wrap(<>
      <label htmlFor={key}>{label(f)}</label>
      <select id={key} value={(v[f.id] as string) || ""} onChange={(e) => set(f.id, e.target.value)} aria-required={f.req ? true : undefined}>
        <option value="">{t(lang, "choose")}</option>
        {opts.map((o) => <option key={o[0]} value={o[0]}>{o[L]}</option>)}
      </select>
    </>);
    const multi = f.type === "checks";
    const cur = v[f.id];
    return wrap(<>
      <span className="lbl" id={`${key}-l`}>{label(f)}</span>{note(f)}
      <div className="pills" role={multi ? "group" : "radiogroup"} aria-labelledby={`${key}-l`}>
        {opts.map((o, i) => (
          <label key={o[0]}>
            <input type={multi ? "checkbox" : "radio"} name={key} id={`${key}-${i}`} value={o[0]}
              checked={multi ? ((cur as string[]) || []).includes(o[0]) : cur === o[0]}
              onChange={(e) => set(f.id, multi ? (e.target.checked ? [...((cur as string[]) || []), o[0]] : ((cur as string[]) || []).filter((x) => x !== o[0])) : o[0])} />
            <span>{o[L]}</span>
          </label>
        ))}
      </div>
    </>);
  }

  if (done !== null) return (
    <div className="done">
      <h2>{lang === "ar" ? "وصلنا." : "Received."}</h2>
      <p className="muted">{t(lang, "sent")} {done}</p>
      <div><button className="arrowlink" type="button" onClick={() => setDone(null)}>{t(lang, "edit")}</button></div>
    </div>
  );

  return (
    <form className="f" noValidate onSubmit={onSubmit}>
      {rows.map((r, i) => (Array.isArray(r) ? <div className="row2" key={i}>{r.map(field)}</div> : field(r)))}
      <Turnstile lang={lang} onToken={setToken} />
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{submit[lang === "ar" ? 1 : 0]}</button>
        <span className={"status" + (status.err ? " err" : "")} role="status">{status.text}</span>
      </div>
    </form>
  );
}
