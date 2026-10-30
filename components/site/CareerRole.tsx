"use client";
import { useRef, useState } from "react";
import { FormBox } from "./forms/FormBox";
import { careersFields, CAREERS_SUBMIT } from "@/lib/forms";
import { t, type Lang } from "@/lib/i18n";
import type { OpenRole } from "@/lib/public-data";

export function CareerRole({ lang, r }: { lang: Lang; r: OpenRole }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ar = lang === "ar";
  return (
    <details className="carrole" data-id={r.slug}>
      <summary>
        <div className="ct">
          <span className="at"><b>{ar ? r.title_ar : r.title_en}</b> <span className="hl">@ {ar ? "سهيل" : "Suhail"}</span></span>
          <span className="pl">{ar ? r.plain_ar : r.plain_en}</span>
          <span className="pt">{ar ? r.pitch_ar : r.pitch_en}</span>
        </div>
      </summary>
      <div className="cbody">
        <p className="mm">{t(lang, "car_meta")}</p>
        <div className="cols">
          <div><span className="eyebrow">{t(lang, "car_do")}</span><ul className="a">{(ar ? r.do_ar : r.do_en).map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><span className="eyebrow">{t(lang, "car_you")}</span><ul className="b">{(ar ? r.you_ar : r.you_en).map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
        <div>
          <button className="pill dark" type="button" onClick={() => {
            setOpen(true);
            setTimeout(() => { box.current?.scrollIntoView({ behavior: "smooth", block: "start" }); box.current?.querySelector("input")?.focus({ preventScroll: true }); }, 50);
          }}>{t(lang, "car_apply")}</button>
        </div>
        <div className="carform" hidden={!open} ref={box}>
          <div className="sec-head"><h2>{(ar ? "قدّم على " : "Apply for ") + (ar ? r.plain_ar : r.plain_en)}</h2><p className="muted">{t(lang, "car_form_p")}</p></div>
          <div className="formbox" data-form={`careers_${r.slug}`}>
            {open ? <FormBox formKey={`careers_${r.slug}`} action={`careers:${r.slug}`} rows={careersFields(r.form_schema)} submit={CAREERS_SUBMIT} lang={lang} /> : null}
          </div>
        </div>
      </div>
    </details>
  );
}
