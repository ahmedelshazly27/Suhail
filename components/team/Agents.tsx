"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { askAgent, cancelAsk, createAgentKey, decideItem, pauseAgents, revokeAgentKey, saveAgent, setAgent } from "@/app/actions/agents";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";

// Interactive parts of the Agents page. Every action goes through server actions that check roles again.

type P = { id: string; name: string };
export type AgentRow = {
  key: string; name: string; name_ar: string; desk: string; purpose: string; instructions: string; lessons: string; days: number[]; shift: string;
  model: string; web: boolean; reads: string[]; owner_id: string | null; enabled: boolean; run_requested_at: string | null;
};
export type ItemRow = {
  id: string; agent_key: string; kind: string; title: string; body: string; data: Record<string, unknown>; sources: { url: string; title?: string; date?: string }[];
  score: number | null; status: string; feedback: string; routed_type: string | null; routed_id: string | null; created_at: string; request_id: string | null;
};
const L = (lang: TLang, en: string, ar: string) => (lang === "ar" ? ar : en);
const DAYS: [string, string][] = [["Sun", "أحد"], ["Mon", "اثنين"], ["Tue", "ثلاثاء"], ["Wed", "أربعاء"], ["Thu", "خميس"], ["Fri", "جمعة"], ["Sat", "سبت"]];
const SHIFT_L: Record<string, [string, string]> = { early: ["Early, 05:00", "الفجر، ٥:٠٠"], morning: ["Morning, 08:00", "الصبح، ٨:٠٠"], midday: ["Midday, 12:00", "الظهر، ١٢:٠٠"], afternoon: ["Afternoon, 16:00", "العصر، ٤:٠٠"] };
const READS: Record<string, [string, string]> = {
  plan: ["Plan", "الخطة"], relationships: ["Relationships", "العلاقات"], content: ["Content calendar", "تقويم المحتوى"], stories: ["Approved stories", "الأخبار المعتمدة"],
  projects: ["Projects", "المشاريع"], tickets: ["Tickets", "المهام"], events: ["Events", "الفعاليات"], metrics: ["Numbers", "الأرقام"], agents: ["Other agents' work", "شغل باقي الوكلاء"],
};
const ROUTE_L: Record<string, [string, string, string]> = {
  content: ["Content calendar", "تقويم المحتوى", "/team/content"], newsletter: ["Newsletter", "النشرة", "/team/newsletter"],
  relationship: ["Relationships", "العلاقات", "/team/relationships"], ticket: ["Tickets", "المهام", "/team/tickets"],
};
/** Where Approve sends each kind; kinds without a destination are kept in the library. */
const DEST: Record<string, string> = { post: "content", newsletter: "newsletter", lead: "relationship", person: "relationship", grant: "ticket", task: "ticket", event: "ticket", project: "ticket" };

function useRun(lang: TLang) {
  const [pending, start] = useTransition();
  const router = useRouter(), toast = useToast();
  return { pending, run: (fn: () => Promise<unknown>, ok?: string) => start(async () => { try { await fn(); if (ok) toast(ok); router.refresh(); } catch (e) { toast((e as Error).message || tt(lang, "error")); } }) };
}

function Dialog({ title, onClose, children, lang, onSubmit, wide }: { title: string; onClose: () => void; children: ReactNode; lang: TLang; onSubmit?: (f: FormData) => void; wide?: boolean }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form className={`dialog${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="ag-h" action={onSubmit} onSubmit={onSubmit ? undefined : (e) => e.preventDefault()}>
        <div style={{ display: "flex", alignItems: "center" }}><h2 id="ag-h">{title}</h2><button type="button" className="x" aria-label={tt(lang, "close")} onClick={onClose}>×</button></div>
        {children}
      </form>
    </div>
  );
}

/** Light Markdown for agent drafts: headings, bullets and links, nothing else. Text stays text (no HTML is injected). */
export function Md({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
  const inline = (s: string, k: number) => s.split(/(https?:\/\/[^\s)]+|\*\*[^*]+\*\*)/g).map((p, i) =>
    /^https?:\/\//.test(p) ? <a key={`${k}-${i}`} href={p} target="_blank" rel="noreferrer">{p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}</a>
      : /^\*\*.+\*\*$/.test(p) ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : p);
  return (
    <div className="md" dir="auto">
      {blocks.map((b, i) => {
        const h = /^#{1,4}\s+(.*)$/.exec(b.trim());
        if (h && !b.trim().includes("\n")) return <h3 key={i}>{inline(h[1], i)}</h3>;
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""), i * 100 + j)}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j ? <br /> : null}{inline(l, i * 100 + j)}</span>)}</p>;
      })}
    </div>
  );
}

/** One draft in the review queue: approve (optionally after editing), reject with a reason the agent learns from. */
export function ItemCard({ lang, item, agentName, canDecide, open: openAtStart }: { lang: TLang; item: ItemRow; agentName: string; canDecide: boolean; open?: boolean }) {
  const { run, pending } = useRun(lang);
  const [open, setOpen] = useState(Boolean(openAtStart) || item.kind === "brief");
  const [mode, setMode] = useState<"" | "edit" | "reject">("");
  const dest = DEST[item.kind], routed = item.routed_type ? ROUTE_L[item.routed_type] : null;
  const meta = [item.data.channel, item.data.lang, item.data.publish_on && `${L(lang, "publish", "نشر")} ${item.data.publish_on}`, item.data.due_on && `${L(lang, "due", "موعد")} ${item.data.due_on}`, item.data.org !== item.title && item.data.org].filter(Boolean).map(String);
  const approve = (title?: string, body?: string) => run(() => decideItem({ id: item.id, action: "approve", title, body }), dest ? `${L(lang, "Sent to", "انرسل إلى")} ${L(lang, ROUTE_L[dest][0], ROUTE_L[dest][1])}` : L(lang, "Approved", "تمام، اعتمدناه"));
  return (
    <article className={`card pad ag-item${item.kind === "brief" ? " brief" : ""}`} id={`item-${item.id}`}>
      <div className="ag-item-h">
        <span className="chip">{item.kind}</span>
        <span className="key">{agentName}</span>
        {item.score ? <span className="ag-score" aria-label={`${L(lang, "Score", "التقييم")} ${item.score}/5`}>{"●".repeat(item.score)}<span className="faint">{"●".repeat(5 - item.score)}</span></span> : null}
        {item.status !== "new" ? <span className={`chip${item.status === "rejected" ? " dashed" : ""}`}>{L(lang, { approved: "Approved", rejected: "Rejected", done: "Done" }[item.status] || item.status, { approved: "معتمد", rejected: "مرفوض", done: "خلص" }[item.status] || item.status)}</span> : null}
      </div>
      <button type="button" className="ag-title" aria-expanded={open} onClick={() => setOpen(!open)} dir="auto">{item.title}</button>
      {meta.length ? <span className="muted ag-meta" dir="auto">{meta.join(" · ")}</span> : null}
      {open ? (
        <>
          {mode === "edit" ? (
            <form className="col" action={(f) => { approve(String(f.get("title")), String(f.get("body"))); setMode(""); }}>
              <label className="fld"><span>{L(lang, "Title", "العنوان")}</span><input name="title" defaultValue={item.title} maxLength={300} required dir="auto" /></label>
              <label className="fld"><span>{L(lang, "Text", "النص")}</span><textarea name="body" defaultValue={item.body} rows={12} dir="auto" /></label>
              <div className="row-btns"><button className="b" disabled={pending}>{L(lang, "Save and approve", "احفظ واعتمد")}</button><button type="button" className="b quiet" onClick={() => setMode("")}>{tt(lang, "cancel")}</button></div>
            </form>
          ) : <Md text={item.body} />}
          {item.sources.length ? (
            <ul className="ag-src">{item.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer" dir="auto">{s.title || s.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}</a>{s.date ? <span className="muted"> · {s.date}</span> : null}</li>)}</ul>
          ) : null}
          {item.feedback ? <p className="muted ag-fb" dir="auto">{L(lang, "Feedback", "الملاحظة")}: {item.feedback}</p> : null}
        </>
      ) : null}
      {mode === "reject" ? (
        <form className="col" action={(f) => { run(() => decideItem({ id: item.id, action: "reject", feedback: String(f.get("feedback") || "") }), L(lang, "Rejected. The agent will learn from it.", "انرفض. الوكيل بيتعلم منه.")); setMode(""); }}>
          <label className="fld"><span>{L(lang, "Why? The agent reads this next time.", "ليش؟ الوكيل يقرا هالشي المرة الجاية.")}</span><input name="feedback" maxLength={1000} autoFocus dir="auto" placeholder={L(lang, "Too old, not relevant to builders, wrong tone…", "قديم، ما يهم المطوّرين، الأسلوب مو مضبوط…")} /></label>
          <div className="row-btns"><button className="b" disabled={pending}>{L(lang, "Reject", "ارفض")}</button><button type="button" className="b quiet" onClick={() => setMode("")}>{tt(lang, "cancel")}</button></div>
        </form>
      ) : null}
      {canDecide && mode === "" ? (
        <div className="row-btns">
          {item.status === "new" ? (
            item.kind === "brief" || item.kind === "answer" || item.kind === "insight" ? (
              <>
                <button type="button" className="b" disabled={pending} onClick={() => run(() => decideItem({ id: item.id, action: item.kind === "insight" ? "approve" : "done" }))}>{item.kind === "insight" ? L(lang, "Useful", "مفيد") : L(lang, "Done", "تم")}</button>
                {item.kind === "insight" ? <button type="button" className="b quiet" onClick={() => { setOpen(true); setMode("reject"); }}>{L(lang, "Not useful", "مو مفيد")}</button> : null}
              </>
            ) : (
              <>
                <button type="button" className="b" disabled={pending} onClick={() => approve()}>{dest ? `${L(lang, "Approve to", "اعتمد إلى")} ${L(lang, ROUTE_L[dest][0], ROUTE_L[dest][1])}` : L(lang, "Approve", "اعتمد")}</button>
                <button type="button" className="b quiet" onClick={() => { setOpen(true); setMode("edit"); }}>{L(lang, "Edit", "عدّل")}</button>
                <button type="button" className="b quiet" onClick={() => { setOpen(true); setMode("reject"); }}>{L(lang, "Reject", "ارفض")}</button>
              </>
            )
          ) : (
            <>
              {routed && item.routed_type ? <a className="b quiet" href={item.routed_type === "ticket" ? `/team/tickets?t=${item.routed_id}` : routed[2]}>{L(lang, `Open in ${routed[0]}`, `افتح في ${routed[1]}`)}</a> : null}
              {!item.routed_id ? <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => decideItem({ id: item.id, action: "reopen" }))}>{L(lang, "Back to review", "رجّعه للمراجعة")}</button> : null}
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

/** An agent's settings: its brief, what it learned, its schedule, what it reads, and whose desk it works on. */
export function AgentSettings({ lang, a, people, isAdmin, canEdit }: { lang: TLang; a: AgentRow; people: P[]; isAdmin: boolean; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useRun(lang);
  return (
    <>
      <button type="button" className="b quiet" onClick={() => setOpen(true)}>{canEdit ? L(lang, "Settings", "الإعدادات") : L(lang, "How it works", "شلون يشتغل")}</button>
      {open ? (
        <Dialog lang={lang} wide title={a.name} onClose={() => setOpen(false)} onSubmit={canEdit ? (f) => run(async () => {
          await saveAgent({
            key: a.key, name: String(f.get("name")), purpose: String(f.get("purpose")), instructions: String(f.get("instructions")), lessons: String(f.get("lessons")),
            days: f.getAll("days").map(Number), shift: String(f.get("shift")) as "early", model: String(f.get("model")) as "sonnet", web: f.get("web") === "on",
            reads: f.getAll("reads").map(String) as "plan"[], owner_id: String(f.get("owner_id") || "") || null,
          });
          setOpen(false);
        }, tt(lang, "saved")) : undefined}>
          <fieldset disabled={!canEdit} className="col" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="grid-2" style={{ gap: ".75rem" }}>
              <label className="fld"><span>{L(lang, "Name", "الاسم")}</span><input name="name" defaultValue={a.name} required maxLength={80} /></label>
              <label className="fld"><span>{L(lang, "Works for", "يشتغل مع")}</span>
                <select name="owner_id" defaultValue={a.owner_id ?? ""} disabled={!isAdmin}><option value="">{L(lang, "The founders", "المؤسسين")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <span className="help">{L(lang, "When you hire for this desk, pick the new person here. The agent keeps everything it learned and starts working for them.", "لما توظّف لهالقسم، اختار الشخص هني. الوكيل يحتفظ بكل اللي تعلّمه ويصير يشتغل معاه.")}</span>
              </label>
            </div>
            <label className="fld"><span>{L(lang, "In one line", "بسطر واحد")}</span><input name="purpose" defaultValue={a.purpose} maxLength={300} /></label>
            <label className="fld"><span>{L(lang, "Instructions", "التعليمات")}</span><textarea name="instructions" defaultValue={a.instructions} rows={12} maxLength={20000} dir="auto" /></label>
            <label className="fld"><span>{L(lang, "What it has learned", "اللي تعلّمه")}</span><textarea name="lessons" defaultValue={a.lessons} rows={5} maxLength={8000} dir="auto"
              placeholder={L(lang, "Rules from your feedback, one per line. The agent adds to these too.", "قواعد من ملاحظاتك، كل وحدة بسطر. الوكيل يضيف عليها بعد.")} /></label>
            <div className="fld"><span>{L(lang, "Days (Kuwait time)", "الأيام (بتوقيت الكويت)")}</span>
              <div className="ag-days">{DAYS.map(([en, ar], i) => <label key={i} className="ag-chk"><input type="checkbox" name="days" value={i} defaultChecked={a.days.includes(i)} />{L(lang, en, ar)}</label>)}</div>
            </div>
            <div className="grid-2" style={{ gap: ".75rem" }}>
              <label className="fld"><span>{L(lang, "Shift", "الوقت")}</span><select name="shift" defaultValue={a.shift}>{Object.entries(SHIFT_L).map(([k, l]) => <option key={k} value={k}>{L(lang, ...l)}</option>)}</select></label>
              <label className="fld"><span>{L(lang, "Depth", "العمق")}</span>
                <select name="model" defaultValue={a.model}>
                  <option value="haiku">{L(lang, "Quick (Haiku)", "سريع (Haiku)")}</option><option value="sonnet">{L(lang, "Balanced (Sonnet)", "متوازن (Sonnet)")}</option><option value="opus">{L(lang, "Deepest (Opus)", "الأعمق (Opus)")}</option>
                </select>
                <span className="help">{L(lang, "Deeper uses more of your Claude plan.", "الأعمق ياخذ أكثر من باقة Claude.")}</span>
              </label>
            </div>
            <label className="ag-chk"><input type="checkbox" name="web" defaultChecked={a.web} />{L(lang, "Searches the web", "يدوّر في الإنترنت")}</label>
            <div className="fld"><span>{L(lang, "Reads from the dashboard", "يقرا من لوحة الفريق")}</span>
              <div className="ag-days">{Object.entries(READS).map(([k, l]) => <label key={k} className="ag-chk"><input type="checkbox" name="reads" value={k} defaultChecked={a.reads.includes(k)} />{L(lang, ...l)}</label>)}</div>
              <span className="help">{L(lang, "Only what it needs goes in its brief, which keeps runs light. It can look up anything else during a run.", "ياخذ بس اللي يحتاجه، عشان يكون الشغل خفيف. وإذا احتاج شي ثاني يقدر يدوّره وهو شغّال.")}</span>
            </div>
          </fieldset>
          {canEdit ? <div className="row-btns"><button className="b" disabled={pending}>{tt(lang, "save")}</button><button type="button" className="b quiet" onClick={() => setOpen(false)}>{tt(lang, "cancel")}</button></div> : null}
        </Dialog>
      ) : null}
    </>
  );
}

export function AgentButtons({ lang, a, canEdit }: { lang: TLang; a: AgentRow; canEdit: boolean }) {
  const { run, pending } = useRun(lang);
  if (!canEdit) return null;
  return (
    <>
      <button type="button" className="b quiet" disabled={pending || Boolean(a.run_requested_at) || !a.enabled} onClick={() => run(() => setAgent(a.key, { run: true }), L(lang, "It runs at the next shift.", "بيشتغل في الوقت الجاي."))}>
        {a.run_requested_at ? L(lang, "Runs next shift", "بيشتغل الوقت الجاي") : L(lang, "Run next shift", "شغّله الوقت الجاي")}
      </button>
      <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => setAgent(a.key, { enabled: !a.enabled }))}>{a.enabled ? L(lang, "Pause", "وقّفه") : L(lang, "Resume", "رجّعه")}</button>
    </>
  );
}

export function PauseAll({ lang, paused }: { lang: TLang; paused: boolean }) {
  const { run, pending } = useRun(lang);
  return (
    <button type="button" className={`b ${paused ? "" : "quiet"}`} disabled={pending} onClick={() => run(() => pauseAgents(!paused), paused ? L(lang, "The team is back on.", "رجع الفريق يشتغل.") : L(lang, "Every agent is paused.", "وقّفنا كل الوكلاء."))}>
      {paused ? L(lang, "Resume the team", "رجّع الفريق") : L(lang, "Pause all agents", "وقّف كل الوكلاء")}
    </button>
  );
}

export function AskForm({ lang, agents, defaultKey }: { lang: TLang; agents: { key: string; name: string }[]; defaultKey?: string }) {
  const { run, pending } = useRun(lang);
  const [n, setN] = useState(0);
  return (
    <form key={n} className="card pad" action={(f) => run(async () => { await askAgent(String(f.get("agent")), String(f.get("body"))); setN(n + 1); }, L(lang, "Sent. It answers at its next shift.", "انرسل. بيرد عليك في الوقت الجاي."))}>
      <h2>{L(lang, "Ask an agent", "اطلب من وكيل")}</h2>
      <label className="fld"><span>{L(lang, "Agent", "الوكيل")}</span><select name="agent" defaultValue={defaultKey}>{agents.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
      <label className="fld"><span>{L(lang, "What do you need?", "شنو تحتاج؟")}</span><textarea name="body" rows={3} required maxLength={2000} dir="auto"
        placeholder={L(lang, "Research Hub71's new program and who runs it. Draft a post about our hackathon dates. Find venues in Riyadh for 150 people.", "دوّر على برنامج Hub71 الجديد ومنو مسؤول عنه. اكتب بوست عن مواعيد الهاكاثون. دوّر قاعات في الرياض لـ١٥٠ شخص.")} /></label>
      <div className="row-btns"><button className="b" disabled={pending}>{L(lang, "Send", "أرسل")}</button></div>
    </form>
  );
}

export function CancelAsk({ lang, id }: { lang: TLang; id: string }) {
  const { run, pending } = useRun(lang);
  return <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => cancelAsk(id))}>{tt(lang, "cancel")}</button>;
}

/** Create the routine's key (shown once) and revoke old ones. */
export function KeyPanel({ lang, keys }: { lang: TLang; keys: { id: string; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null }[] }) {
  const { run, pending } = useRun(lang);
  const [shown, setShown] = useState("");
  const toast = useToast();
  return (
    <div className="col">
      {shown ? (
        <div className="card pad soft">
          <h2>{L(lang, "Your key (shown once)", "المفتاح (يطلع مرة وحدة بس)")}</h2>
          <code className="ag-key">{shown}</code>
          <div className="row-btns">
            <button type="button" className="b" onClick={() => { navigator.clipboard?.writeText(shown); toast(tt(lang, "copied")); }}>{L(lang, "Copy", "انسخ")}</button>
            <button type="button" className="b quiet" onClick={() => setShown("")}>{L(lang, "I saved it", "حفظته")}</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: ".8125rem" }}>{L(lang, "Paste it only into the secure Claude form for team.suhail.build. Never in a chat or a document.", "الصقه بس في نموذج Claude الآمن حق team.suhail.build. لا تحطه في محادثة أو ملف.")}</p>
        </div>
      ) : (
        <form className="row-btns" action={(f) => run(async () => setShown(await createAgentKey(String(f.get("name") || "Claude routine"))))}>
          <input name="name" className="inp" defaultValue="Claude routine" maxLength={80} aria-label={L(lang, "Key name", "اسم المفتاح")} />
          <button className="b" disabled={pending}>{L(lang, "Create a key", "سوّ مفتاح")}</button>
        </form>
      )}
      {keys.length ? (
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{L(lang, "Key", "المفتاح")}</th><th>{L(lang, "Created", "انسوّى")}</th><th>{L(lang, "Last used", "آخر استخدام")}</th><th /></tr></thead><tbody>
          {keys.map((k) => <tr key={k.id} style={{ cursor: "default" }}><td>{k.name}</td><td>{k.created_at.slice(0, 10)}</td><td>{k.last_used_at ? k.last_used_at.slice(0, 16).replace("T", " ") : "–"}</td>
            <td className="n">{k.revoked_at ? <span className="chip dashed">{L(lang, "Revoked", "ملغي")}</span> : <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => revokeAgentKey(k.id))}>{L(lang, "Revoke", "ألغِ")}</button>}</td></tr>)}
        </tbody></table></div>
      ) : null}
    </div>
  );
}
