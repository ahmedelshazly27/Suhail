import { Avatar } from "@/components/ui/Avatar";
import { Chip, Empty, StatusDot } from "@/components/ui/Status";
import { COLORS, RADII, SPACE, TOKENS } from "@/lib/design-tokens";
import { STATUSES, tt, type TLang } from "@/lib/team-i18n";

/** One frame of the specimen. Rendered four times: light and dark, English and Arabic. */
export function Specimen({ lang, theme }: { lang: TLang; theme: "light" | "dark" }) {
  const ar = lang === "ar";
  return (
    <>
      <span className="eb">{theme} · {ar ? "العربي" : "English"}</span>
      <div className="spec-grid">{COLORS.map((c) => <div key={c} className="swatch"><div style={{ background: `var(--${c})` }} /><p>--{c}<br /><span className="muted">{(theme === "dark" ? (TOKENS.dark as Record<string, string>)[c] : undefined) ?? (TOKENS.light as Record<string, string>)[c]}</span></p></div>)}</div>
      <div className="spec-row">{RADII.map((r) => <span key={r} style={{ width: "3rem", height: "3rem", border: "1px solid var(--fg)", borderRadius: `var(--${r})`, display: "grid", placeItems: "center", fontSize: ".625rem" }} className="mono">{r.slice(2)}</span>)}</div>
      <div className="spec-row">{SPACE.map((s) => <span key={s} title={`--${s}`} style={{ width: `var(--${s})`, height: ".75rem", background: "var(--fg)" }} />)}</div>
      <h1 style={{ font: "300 2.25rem/1.15 var(--f-display)", margin: 0 }}>{ar ? "منظومة واحدة للناس اللي يبنون" : "One ecosystem for builders"}</h1>
      <p style={{ font: "300 1.0625rem/1.7 var(--f-body)" }}>{ar ? "سهيل يجمع المؤسّسين والمهندسين والمستثمرين." : "Suhail brings together founders, engineers and investors."}</p>
      <div className="spec-row"><span className="eb">{ar ? "عنوان صغير" : "Eyebrow"}</span><span className="label-s">{ar ? "تسمية" : "Label"}</span><span className="key">SUH-142</span><span className="num">1,240</span><span className="soontag">{ar ? "قريبًا" : "Coming soon"}</span></div>
      <div className="spec-row"><button className="b" type="button">{tt(lang, "newTicket")}</button><button className="b ghost" type="button">{tt(lang, "cancel")}</button><button className="b quiet" type="button">{tt(lang, "save")}</button><button className="b" type="button" disabled>{tt(lang, "send")}</button></div>
      <div className="spec-row"><span className="pill-s on">{tt(lang, "dueThisWeek")}</span><span className="pill-s">{tt(lang, "allAssigned")}</span><Chip>{ar ? "لوجستيات" : "Logistics"}</Chip><Chip attn>{ar ? "رعاة" : "Sponsors"}</Chip><Chip dashed>+ {tt(lang, "labels")}</Chip></div>
      <div className="spec-row">{STATUSES.map((s) => <span key={s} style={{ display: "inline-flex", gap: ".375rem", alignItems: "center", fontSize: ".8125rem" }}><StatusDot s={s} />{tt(lang, s)}</span>)}</div>
      <div className="spec-row"><Avatar name="Ahmed El Shazly" /><Avatar name="Sara" size="md" /><Avatar name="Layla" size="lg" ink /><span className="due">{tt(lang, "tomorrow")}</span><span className="due today">{tt(lang, "today")}</span><span className="due late">{ar ? "متأخرة يومين" : "Overdue 2 d"}</span></div>
      <label className="fld"><span>{tt(lang, "name")}</span><input placeholder={ar ? "اكتب هنا" : "Type here"} /><span className="help">{ar ? "نص مساعد" : "Help text"}</span></label>
      <div className="checks"><label><input type="checkbox" defaultChecked /><span>{ar ? "مهندس" : "Engineer"}</span></label><label><input type="checkbox" /><span>{ar ? "باحث" : "Researcher"}</span></label></div>
      <p className="quote">{ar ? "«إذا طلع سهيل… برد الليل.»" : '"When Suhail rises, the night cools."'}</p>
      <div className="card"><div className="card-h"><h2>{tt(lang, "myWork")}</h2><span className="key">2</span></div><div className="row row-work"><StatusDot s="in_progress" /><span className="key">SUH-142</span><span className="ell">{ar ? "تأكيد مكان الهاكاثون" : "Confirm venue"}</span><Chip attn>{tt(lang, "in_progress")}</Chip><span className="due today">{tt(lang, "today")}</span></div></div>
      <div className="bcol"><div className="bcol-h"><StatusDot s="todo" /><span>{tt(lang, "todo")}</span><span className="n">1</span></div><div className="bcard"><span className="top"><span className="key">SUH-151</span><span className="key">3 {tt(lang, "pt")}</span></span><span className="ttl">{ar ? "عرض الرعاة" : "Sponsor deck v2"}</span><span className="meta"><Chip attn>{ar ? "رعاة" : "Sponsors"}</Chip><span className="due">Fri</span><Avatar name="Ahmed E" /></span></div></div>
      <div className="band"><div className="dither" aria-hidden="true" /><h2 style={{ margin: 0, fontSize: ".875rem", fontWeight: 500 }}>{tt(lang, "sprint")} 4</h2><span><span className="big num">18</span> <span className="muted">{tt(lang, "of")} 31</span></span><div className="track"><span style={{ width: "58%" }} /></div></div>
      <table className="tbl"><thead><tr><th>{tt(lang, "name")}</th><th className="n">{tt(lang, "amount")}</th></tr></thead><tbody><tr><td>{ar ? "عربون القاعة" : "Venue deposit"}</td><td className="n">KWD 600</td></tr></tbody></table>
      <div className="toast" style={{ position: "static" }}><span>{tt(lang, "saved")}</span><button type="button">{tt(lang, "undo")}</button></div>
      <Empty text={tt(lang, "emptyList")} action={<button type="button" className="b ghost">{tt(lang, "add")}</button>} />
      <div className="dither" style={{ height: "3rem" }} aria-hidden="true" />
    </>
  );
}
