"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STATIC_FORMS } from "@/lib/forms";
import { href, t, type Key, type Lang } from "@/lib/i18n";
import { FormBox } from "./forms/FormBox";
import { QuickSubscribe } from "./forms/QuickSubscribe";
import { Modal } from "./Modal";
import { SoonBlock } from "./Soon";

const MODALS: Record<string, [Key, Key]> = { talent: ["talent_h", "talent_p"], cofounder: ["cof_h", "cof_p"], company: ["company_h", "company_p"] };

// The board opens later: the prototype ships with no roles, so the lists show the "coming soon" blocks.
export function Jobs({ lang }: { lang: Lang }) {
  const [track, setTrack] = useState<"tech" | "ops">("tech");
  const [modal, setModal] = useState<string | null>(null);
  const q = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName)) { e.preventDefault(); q.current?.focus(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="wrap jb">
      <aside className="jside" aria-label={t(lang, "filters")}>
        <label className="search" htmlFor="q">
          <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.4" /></svg>
          <span className="vh-sr">{t(lang, "search")}</span>
          <input id="q" ref={q} type="text" autoComplete="off" size={8} placeholder={t(lang, "search")} />
        </label>
        <fieldset id="f-where"><legend>{t(lang, "where")}</legend></fieldset>
        <fieldset id="f-stage"><legend>{t(lang, "stage")}</legend></fieldset>
        <fieldset id="f-type"><legend>{t(lang, "type")}</legend></fieldset>
      </aside>
      <div>
        <div className="jhead">
          <div style={{ display: "grid", gap: ".4rem", minWidth: 0 }}>
            <h1>{t(lang, "nav_jobs")}</h1>
            <span className="jsum">{t(lang, "soon_board")}</span>
            <p className="jdesc">{t(lang, "jobs_lede")}</p>
            <div style={{ marginTop: ".8rem" }}>
              <div className="toggle2" role="tablist">
                {(["tech", "ops"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={track === k} onClick={() => setTrack(k)}>{t(lang, k === "tech" ? "tab_tech" : "tab_ops")}</button>)}
              </div>
            </div>
          </div>
          <div className="btns">
            <button className="pill strong" type="button" onClick={() => setModal("talent")}>{t(lang, "cta_talent")}</button>
            <button className="pill" type="button" onClick={() => setModal("cofounder")}>{t(lang, "cta_cof")}</button>
            <button className="pill" type="button" onClick={() => setModal("company")}>{t(lang, "cta_company")}</button>
          </div>
        </div>
        <div style={{ marginTop: "2.6rem" }}><span className="eyebrow">{t(lang, "recent")}</span><div className="recent"><SoonBlock lang={lang} /></div></div>
        <div style={{ marginTop: "2.2rem" }}>
          <div className="bar" style={{ border: 0, padding: 0 }}><span className="eyebrow">{t(lang, "picks")}</span><span className="note" style={{ fontSize: ".8rem" }}>{t(lang, "example_note")}</span></div>
          <div className="cards3"><SoonBlock lang={lang} /></div>
        </div>
        <div className="lockrow">
          <span>🔒&#xFE0E; <span>{t(lang, "lock_p")}</span></span>
          <div style={{ display: "grid", maxWidth: "20rem", width: "100%" }}><QuickSubscribe lang={lang} source="jobs-unlock" variant="pillform" label={t(lang, "unlock")} msgStyle={{ marginTop: ".4rem" }} /></div>
        </div>
        <div id="groups" />
        <div className="gatewrap">
          <div className="blur" id="blurred" />
          <div className="gatecard">
            <h2 className="h3">{t(lang, "more_h")}</h2>
            <p>{t(lang, "more_p")}</p>
            <QuickSubscribe lang={lang} source="jobs" variant="gate" label={t(lang, "sub_unlock")} msgStyle={{ margin: 0 }} />
          </div>
        </div>
        <p className="jfoot"><Link href={href(lang, "/") + "#subscribe"}>{t(lang, "jobs_foot")}</Link></p>
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal ? t(lang, MODALS[modal][0]) : ""} intro={modal ? t(lang, MODALS[modal][1]) : ""} closeLabel={t(lang, "close")}>
        {modal ? <div className="formbox" id="m-box"><FormBox key={modal} formKey={modal} action={modal} rows={STATIC_FORMS[modal].fields} submit={STATIC_FORMS[modal].submit} lang={lang} /></div> : null}
      </Modal>
    </div>
  );
}
