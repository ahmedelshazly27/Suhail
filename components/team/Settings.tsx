"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { replayTour } from "@/app/actions/me";
import { allowTourAgain } from "./Tour";
import { copyRole, regenerateIcs, saveCategory, saveLabel, saveMe, saveMember, saveProjectTemplate, saveRole, saveSettings, saveStages, saveTemplate, setTeamPrefAction } from "@/app/actions/settings";
import { FormBox } from "@/components/site/forms/FormBox";
import { useToast } from "@/components/ui/Toast";
import { careersFields, CAREERS_SUBMIT, type Row } from "@/lib/forms";
import { tt, type TLang } from "@/lib/team-i18n";

const useSave = () => {
  const [pending, start] = useTransition();
  const router = useRouter(), toast = useToast();
  return { pending, run: (fn: () => Promise<unknown>, lang: TLang) => start(async () => { try { await fn(); toast(tt(lang, "saved")); router.refresh(); } catch (e) { toast((e as Error).message || tt(lang, "error")); } }) };
};

export function MeSettings({ lang, theme, me, icsUrl, teamIcsUrl }: { lang: TLang; theme: string; me: { digest_email: boolean; standup_enabled: boolean; capacity: number; name: string; email: string }; icsUrl: string; teamIcsUrl: string }) {
  const { run, pending } = useSave();
  return (
    <div className="col" style={{ maxWidth: "36rem" }}>
      <div className="card pad">
        <h2>{me.name}</h2><span className="muted">{me.email}</span>
        <label className="fld"><span>{tt(lang, "language2")}</span><select value={lang} onChange={(e) => run(async () => { await setTeamPrefAction("team-lang", e.target.value); await saveMe({ lang: e.target.value as TLang }); }, e.target.value as TLang)}><option value="en">English</option><option value="ar">العربية</option></select></label>
        <label className="fld"><span>{tt(lang, "theme")}</span><select value={theme} onChange={(e) => run(() => setTeamPrefAction("team-theme", e.target.value), lang)}>{(["system", "light", "dark"] as const).map((t) => <option key={t} value={t}>{tt(lang, t)}</option>)}</select></label>
        <label style={{ display: "flex", gap: ".5rem", fontSize: ".84375rem" }}><input type="checkbox" defaultChecked={me.digest_email} onChange={(e) => run(() => saveMe({ digest_email: e.target.checked }), lang)} />{lang === "ar" ? "ملخص يومي بالإيميل" : "Daily summary by email"}</label>
        <label style={{ display: "flex", gap: ".5rem", fontSize: ".84375rem" }}><input type="checkbox" defaultChecked={me.standup_enabled} onChange={(e) => run(() => saveMe({ standup_enabled: e.target.checked }), lang)} />{lang === "ar" ? "اسألني أسئلة الاجتماع اليومي في Teams" : "Ask me the stand-up questions in Teams"}</label>
        <label className="fld"><span>{lang === "ar" ? "سعتي في كل دورة (نقاط)" : "My capacity per sprint (points)"}</span><input type="number" min={0} max={60} defaultValue={me.capacity} onBlur={(e) => run(() => saveMe({ capacity: Number(e.target.value) }), lang)} /></label>
      </div>
      <div className="card pad">
        <h2>{tt(lang, "calendarFeed")}</h2><p className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "calendarFeedNote")}</p>
        <input className="inp mono" readOnly value={icsUrl} onFocus={(e) => e.target.select()} aria-label={tt(lang, "calendarFeed")} dir="ltr" />
        <span className="muted" style={{ fontSize: ".75rem" }}>{lang === "ar" ? "رابط الفريق (الفعاليات والمواعيد):" : "Team feed (events and deadlines):"}</span>
        <input className="inp mono" readOnly value={teamIcsUrl} onFocus={(e) => e.target.select()} aria-label={lang === "ar" ? "رابط تقويم الفريق" : "Team calendar feed"} dir="ltr" />
        <button type="button" className="b quiet" style={{ alignSelf: "flex-start" }} disabled={pending} onClick={() => confirm(lang === "ar" ? "الرابط القديم بيوقف. تكمل؟" : "The old link will stop working. Continue?") && run(() => regenerateIcs(), lang)}>{lang === "ar" ? "رابط جديد" : "New link"}</button>
      </div>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <form action={replayTour}><button className="b quiet" type="submit" onClick={allowTourAgain}>{lang === "ar" ? "أعد الجولة التعريفية" : "Replay the tour"}</button></form>
        <form action="/auth/signout" method="post"><button className="b quiet" type="submit">{tt(lang, "signOut")}</button></form>
      </div>
    </div>
  );
}

type Member = { id: string; name: string; email: string; job_title: string; team_role: string; functions: string[]; active: boolean; capacity: number; ms_groups: string[] };
export function Members({ lang, rows }: { lang: TLang; rows: Member[] }) {
  const { run } = useSave();
  const FN = ["finance", "partnerships", "events", "editorial", "engineering"];
  return (
    <div className="col">
      <p className="muted" style={{ fontSize: ".8125rem", maxWidth: "40rem" }}>{lang === "ar" ? "الصلاحيات تجي من مجموعات Microsoft 365: suhail-owners وsuhail-admins وsuhail-team. أضف أو شيل الشخص هناك، ويتحدّث هنا أول ما يدخل. هنا تحدد وظيفته (مثل المالية) وسعته." : "Access comes from the Microsoft 365 groups suhail-owners, suhail-admins and suhail-team. Add or remove someone there and it updates here the next time they sign in. Here you set their function (such as Finance) and capacity."}</p>
      <div className="tbl-wrap" tabIndex={0}><table className="tbl">
        <thead><tr><th>{tt(lang, "name")}</th><th>{tt(lang, "role")}</th><th>{lang === "ar" ? "الوظيفة" : "Function"}</th><th className="n">{tt(lang, "capacity")}</th><th>{tt(lang, "status")}</th></tr></thead>
        <tbody>{rows.map((m) => (
          <tr key={m.id} style={{ cursor: "default" }}>
            <td><span className="stack-t"><span>{m.name}</span><span className="s">{m.email}{m.job_title ? ` · ${m.job_title}` : ""}</span></span></td>
            <td>{tt(lang, m.team_role === "member" ? "member" : (m.team_role as "owner"))}</td>
            <td><span style={{ display: "flex", gap: ".25rem", flexWrap: "wrap" }}>{FN.map((f) => { const on = m.functions.includes(f); return <button key={f} type="button" className={`chip chip-btn${on ? "" : " dashed"}`} aria-pressed={on} onClick={() => run(() => saveMember(m.id, { functions: on ? m.functions.filter((x) => x !== f) : [...m.functions, f] }), lang)}>{f}</button>; })}</span></td>
            <td className="n"><input type="number" min={0} max={60} defaultValue={m.capacity} style={{ width: "3.5rem" }} className="inp" onBlur={(e) => Number(e.target.value) !== m.capacity && run(() => saveMember(m.id, { capacity: Number(e.target.value) }), lang)} aria-label={`${tt(lang, "capacity")} ${m.name}`} /></td>
            <td>{m.active ? tt(lang, "active") : (lang === "ar" ? "موقوف" : "Inactive")}</td>
          </tr>))}</tbody>
      </table></div>
    </div>
  );
}

export function Pipelines({ lang, forms }: { lang: TLang; forms: { key: string; name_en: string; name_ar: string; stages: string[] }[] }) {
  const { run } = useSave();
  return (
    <div className="col" style={{ maxWidth: "44rem" }}>
      {forms.map((f) => (
        <form key={f.key} className="card pad" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("stages")).split(",").map((s) => s.trim()).filter(Boolean); run(() => saveStages(f.key, v), lang); }}>
          <h2>{lang === "ar" ? f.name_ar : f.name_en}</h2>
          <label className="fld"><span>{lang === "ar" ? "المراحل بالترتيب، مفصولة بفاصلة" : "Stages in order, comma separated"}</span><input name="stages" defaultValue={f.stages.join(", ")} /></label>
          <button className="b quiet" style={{ alignSelf: "flex-start" }}>{tt(lang, "save")}</button>
        </form>
      ))}
    </div>
  );
}

type Role = { id: string; slug: string; title_en: string; title_ar: string; plain_en: string; plain_ar: string; pitch_en: string; pitch_ar: string; do_en: string[]; do_ar: string[]; you_en: string[]; you_ar: string[]; form_schema: unknown[]; rubric: { key: string; en: string }[]; status: string; sort: number };
export function RoleEditor({ lang, roles }: { lang: TLang; roles: Role[] }) {
  const { run, pending } = useSave();
  const [cur, setCur] = useState(roles[0]?.id ?? "new");
  const r = roles.find((x) => x.id === cur);
  const [schema, setSchema] = useState(JSON.stringify(r?.form_schema ?? [], null, 1));
  const [previewLang, setPreviewLang] = useState<TLang>("en");
  const parsed = useMemo(() => { try { return JSON.parse(schema) as Row[]; } catch { return null; } }, [schema]);
  const pick = (id: string) => { setCur(id); setSchema(JSON.stringify(roles.find((x) => x.id === id)?.form_schema ?? [], null, 1)); };
  const lines = (s: FormDataEntryValue | null) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="col">
      <div style={{ display: "flex", gap: ".375rem", flexWrap: "wrap" }}>
        {roles.map((x) => <button key={x.id} type="button" className="pill-s" aria-pressed={cur === x.id} onClick={() => pick(x.id)}>{x.title_en} <span className="key">{x.status === "open" ? tt(lang, "openRole") : tt(lang, "closedRole")}</span></button>)}
        <button type="button" className="pill-s" aria-pressed={cur === "new"} onClick={() => { setCur("new"); setSchema("[]"); }}>+ {lang === "ar" ? "دور جديد" : "New role"}</button>
      </div>
      <form key={cur} className="grid-2" style={{ alignItems: "start" }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (!parsed) return;
        run(() => saveRole(r?.id ?? null, { slug: String(f.get("slug") || ""), title_en: String(f.get("title_en")), title_ar: String(f.get("title_ar")), plain_en: String(f.get("plain_en")), plain_ar: String(f.get("plain_ar")), pitch_en: String(f.get("pitch_en")), pitch_ar: String(f.get("pitch_ar")),
          do_en: lines(f.get("do_en")), do_ar: lines(f.get("do_ar")), you_en: lines(f.get("you_en")), you_ar: lines(f.get("you_ar")), form_schema: parsed as never, rubric: lines(f.get("rubric")).map((l, i) => ({ key: `c${i + 1}`, en: l })), status: f.get("status") === "open" ? "open" : "closed", sort: Number(f.get("sort") || 0) }), lang); }}>
        <div className="col" style={{ gap: ".75rem" }}>
          {!r ? <label className="fld"><span>Slug</span><input name="slug" required pattern="[a-z0-9-]{2,40}" dir="ltr" /></label> : null}
          <div className="grid-2" style={{ gap: ".75rem" }}>
            <label className="fld"><span>Title (EN)</span><input name="title_en" defaultValue={r?.title_en} required /></label><label className="fld"><span>العنوان</span><input name="title_ar" dir="rtl" defaultValue={r?.title_ar} required /></label>
            <label className="fld"><span>Plain title (EN)</span><input name="plain_en" defaultValue={r?.plain_en} required /></label><label className="fld"><span>المسمّى</span><input name="plain_ar" dir="rtl" defaultValue={r?.plain_ar} required /></label>
          </div>
          <label className="fld"><span>Pitch (EN)</span><textarea name="pitch_en" defaultValue={r?.pitch_en} /></label><label className="fld"><span>الوصف</span><textarea name="pitch_ar" dir="rtl" defaultValue={r?.pitch_ar} /></label>
          <div className="grid-2" style={{ gap: ".75rem" }}>
            <label className="fld"><span>{lang === "ar" ? "وش بتسوي (EN، سطر لكل نقطة)" : "What you'll do (EN, one per line)"}</span><textarea name="do_en" defaultValue={r?.do_en.join("\n")} /></label><label className="fld"><span>وش بتسوي</span><textarea name="do_ar" dir="rtl" defaultValue={r?.do_ar.join("\n")} /></label>
            <label className="fld"><span>{lang === "ar" ? "ممكن تكون (EN)" : "You might be (EN)"}</span><textarea name="you_en" defaultValue={r?.you_en.join("\n")} /></label><label className="fld"><span>ممكن تكون</span><textarea name="you_ar" dir="rtl" defaultValue={r?.you_ar.join("\n")} /></label>
          </div>
          <label className="fld"><span>{tt(lang, "rubric")} ({lang === "ar" ? "سطر لكل معيار" : "one criterion per line"})</span><textarea name="rubric" defaultValue={r?.rubric.map((c) => c.en).join("\n")} /></label>
          <label className="fld"><span>{lang === "ar" ? "أسئلة الدور (JSON)" : "Role questions (JSON, the prototype's field format)"}</span><textarea className="mono" style={{ minHeight: "16rem", fontSize: ".75rem" }} value={schema} onChange={(e) => setSchema(e.target.value)} dir="ltr" spellCheck={false} />{parsed ? null : <span className="err">{lang === "ar" ? "JSON غير صحيح" : "Not valid JSON"}</span>}</label>
          <div style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>
            <label style={{ display: "flex", gap: ".375rem", fontSize: ".84375rem" }}><input type="checkbox" name="status" value="open" defaultChecked={r?.status === "open"} />{tt(lang, "openRole")}</label>
            <label className="fld" style={{ display: "flex", alignItems: "center", gap: ".375rem" }}><span>{tt(lang, "sort")}</span><input name="sort" type="number" defaultValue={r?.sort ?? roles.length + 1} style={{ width: "4rem" }} /></label>
            <button className="b" type="submit" disabled={pending || !parsed}>{tt(lang, "save")}</button>
            {r ? <button type="button" className="b quiet" onClick={() => run(() => copyRole(r.id), lang)}>{tt(lang, "copy")}</button> : null}
          </div>
        </div>
        <div className="col" style={{ gap: ".75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}><span className="eb">{tt(lang, "preview")}</span><div className="seg2"><button type="button" aria-pressed={previewLang === "en"} onClick={() => setPreviewLang("en")}>EN</button><button type="button" aria-pressed={previewLang === "ar"} onClick={() => setPreviewLang("ar")}>ع</button></div></div>
          <div className="card" style={{ padding: "1.25rem", background: "var(--bg)" }} dir={previewLang === "ar" ? "rtl" : "ltr"} lang={previewLang}>
            {parsed ? <div className="site-preview"><FormBox key={schema + previewLang} formKey="preview" action="preview" rows={careersFields(parsed)} submit={CAREERS_SUBMIT} lang={previewLang} /></div> : null}
          </div>
        </div>
      </form>
    </div>
  );
}

export function Templates({ lang, rows }: { lang: TLang; rows: { key: string; name: string; subject_en: string; subject_ar: string; body_en: string; body_ar: string }[] }) {
  const { run } = useSave();
  return (
    <div className="col">
      <p className="muted" style={{ fontSize: ".8125rem" }}>{lang === "ar" ? "استخدم {{name}} و{{role}}. كل قالب له نسخة عربي ونسخة إنجليزي، ويوصل المتقدّم بلغته." : "Use {{name}} and {{role}}. Each template has an Arabic and an English version; applicants get their own language."}</p>
      {rows.map((t) => (
        <form key={t.key} className="card pad" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveTemplate(t.key, { name: t.name, subject_en: String(f.get("se")), subject_ar: String(f.get("sa")), body_en: String(f.get("be")), body_ar: String(f.get("ba")) }), lang); }}>
          <h2>{t.name}</h2>
          <div className="grid-2" style={{ gap: ".75rem" }}>
            <label className="fld"><span>{tt(lang, "subject")} (EN)</span><input name="se" defaultValue={t.subject_en} /></label><label className="fld"><span>العنوان</span><input name="sa" dir="rtl" defaultValue={t.subject_ar} /></label>
            <label className="fld"><span>English</span><textarea name="be" style={{ minHeight: "9rem" }} defaultValue={t.body_en} /></label><label className="fld"><span>العربي</span><textarea name="ba" dir="rtl" style={{ minHeight: "9rem" }} defaultValue={t.body_ar} /></label>
          </div>
          <button className="b quiet" style={{ alignSelf: "flex-start" }}>{tt(lang, "save")}</button>
        </form>
      ))}
    </div>
  );
}

export function Lists({ lang, labels, categories, templates }: { lang: TLang; labels: { id: string; name: string; attention: boolean }[]; categories: { key: string; name: string }[]; templates: { key: string; name: string; items: unknown }[] }) {
  const { run } = useSave();
  return (
    <div className="col" style={{ maxWidth: "48rem" }}>
      <div className="card pad"><h2>{tt(lang, "labels")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".375rem" }}>{labels.map((l) => <span key={l.id} className={`chip${l.attention ? " attn" : ""}`}>{l.name}<button type="button" className="linkbtn" aria-label={`${tt(lang, "remove")} ${l.name}`} onClick={() => run(() => saveLabel(l.id, l.name, l.attention, true), lang)}>×</button></span>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const n = String(new FormData(f).get("n")); run(() => saveLabel(null, n, new FormData(f).get("a") === "on"), lang); f.reset(); }} style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input name="n" className="inp" placeholder={tt(lang, "name")} required aria-label={tt(lang, "name")} /><label style={{ display: "flex", gap: ".25rem", fontSize: ".75rem", whiteSpace: "nowrap" }}><input type="checkbox" name="a" />{lang === "ar" ? "يحتاج انتباه" : "Needs attention"}</label><button className="b quiet">{tt(lang, "add")}</button></form>
      </div>
      <div className="card pad"><h2>{tt(lang, "categories")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".375rem" }}>{categories.map((c) => <span key={c.key} className="chip">{c.name}<button type="button" className="linkbtn" aria-label={`${tt(lang, "remove")} ${c.name}`} onClick={() => run(() => saveCategory(c.key, c.name, true), lang)}>×</button></span>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const n = String(new FormData(f).get("n")); run(() => saveCategory(n.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30), n), lang); f.reset(); }} style={{ display: "flex", gap: ".5rem" }}><input name="n" className="inp" required aria-label={tt(lang, "name")} placeholder={tt(lang, "name")} /><button className="b quiet">{tt(lang, "add")}</button></form>
      </div>
      {templates.map((t) => (
        <form key={t.key} className="card pad" onSubmit={(e) => { e.preventDefault(); run(() => saveProjectTemplate(t.key, t.name, String(new FormData(e.currentTarget).get("items"))), lang); }}>
          <h2>{tt(lang, "templates")}: {t.name}</h2>
          <span className="muted" style={{ fontSize: ".75rem" }}>{lang === "ar" ? "offset_days: الأيام قبل (سالب) أو بعد موعد المشروع. role: وظيفة المسؤول." : "offset_days: days before (negative) or after the project's target date. role: the owner's function."}</span>
          <textarea name="items" className="inp mono" style={{ minHeight: "12rem", fontSize: ".75rem" }} defaultValue={JSON.stringify(t.items, null, 1)} dir="ltr" spellCheck={false} />
          <button className="b quiet" style={{ alignSelf: "flex-start" }}>{tt(lang, "save")}</button>
        </form>
      ))}
    </div>
  );
}

type S = { sprint_length_days: number; retention_not_now_months: number; operations_budget?: number; standup: { enabled: boolean; time: string; days: number[]; tz: string }; m365: Record<string, boolean>; teams: { channel_webhook: boolean; bot: boolean } };
export function General({ lang, s, status }: { lang: TLang; s: S; status: { azure: boolean; webhook: boolean; bot: boolean; tasks: string; drive: boolean } }) {
  const { run } = useSave();
  const DAYS = lang === "ar" ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ok = (b: boolean) => <span className={`chip${b ? "" : " dashed"}`}>{b ? (lang === "ar" ? "متصل" : "Connected") : (lang === "ar" ? "مو متصل" : "Not connected")}</span>;
  return (
    <div className="col" style={{ maxWidth: "40rem" }}>
      <div className="card pad"><h2>{tt(lang, "sprints")}</h2>
        <label className="fld"><span>{tt(lang, "sprintLength")} ({tt(lang, "days")})</span><input type="number" min={5} max={42} defaultValue={s.sprint_length_days} onBlur={(e) => run(() => saveSettings({ sprint_length_days: Number(e.target.value) }), lang)} /></label>
        <label className="fld"><span>{lang === "ar" ? "ميزانية العمليات (KWD)" : "Operations budget (KWD)"}</span><input type="number" min={0} defaultValue={s.operations_budget ?? 0} onBlur={(e) => run(() => saveSettings({ operations_budget: Number(e.target.value) }), lang)} /></label>
      </div>
      <div className="card pad"><h2>{tt(lang, "standup")}</h2>
        <label style={{ display: "flex", gap: ".5rem", fontSize: ".84375rem" }}><input type="checkbox" defaultChecked={s.standup.enabled} onChange={(e) => run(() => saveSettings({ standup: { ...s.standup, enabled: e.target.checked } }), lang)} />{lang === "ar" ? "اسأل الفريق في Teams" : "Ask the team in Teams"}</label>
        <label className="fld"><span>{tt(lang, "when")}</span><input type="time" defaultValue={s.standup.time} onBlur={(e) => run(() => saveSettings({ standup: { ...s.standup, time: e.target.value } }), lang)} /></label>
        <div className="checks" role="group" aria-label={tt(lang, "days")}>{DAYS.map((d, i) => <label key={i}><input type="checkbox" defaultChecked={s.standup.days.includes(i)} onChange={(e) => run(() => saveSettings({ standup: { ...s.standup, days: e.target.checked ? [...s.standup.days, i].sort() : s.standup.days.filter((x) => x !== i) } }), lang)} /><span>{d}</span></label>)}</div>
      </div>
      <div className="card pad"><h2>{tt(lang, "teamsSettings")}</h2>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>{lang === "ar" ? "قناة الفريق (Workflows webhook)" : "Team channel (Workflows webhook)"}</span>{ok(status.webhook)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>{lang === "ar" ? "بوت سهيل (بطاقات شخصية)" : "Suhail bot (personal cards)"}</span>{ok(status.bot)}</div>
        <span className="muted" style={{ fontSize: ".75rem" }}>{lang === "ar" ? "الروابط والمعرّفات تنحط في إعدادات Vercel. الخطوات في docs/microsoft.md." : "URLs and IDs are set in Vercel. Steps in docs/microsoft.md."}</span>
      </div>
      <div className="card pad"><h2>{tt(lang, "m365")}</h2>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Entra ID</span>{ok(status.azure)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>SharePoint drive</span>{ok(status.drive)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>tasks@</span>{status.tasks ? <span className="chip">{status.tasks}</span> : ok(false)}</div>
        {Object.entries(s.m365).map(([k, v]) => <label key={k} style={{ display: "flex", gap: ".5rem", fontSize: ".84375rem" }}><input type="checkbox" defaultChecked={v} onChange={(e) => run(() => saveSettings({ m365: { ...s.m365, [k]: e.target.checked } }), lang)} />{k.replace(/_/g, " ")}</label>)}
      </div>
      <div className="card pad"><h2>{tt(lang, "retention")}</h2>
        <label className="fld"><span>{lang === "ar" ? "احذف طلبات «مو الحين» بعد (أشهر)" : 'Delete "Not now" applications after (months)'}</span><input type="number" min={1} max={60} defaultValue={s.retention_not_now_months} onBlur={(e) => run(() => saveSettings({ retention_not_now_months: Number(e.target.value) }), lang)} /></label>
      </div>
    </div>
  );
}
