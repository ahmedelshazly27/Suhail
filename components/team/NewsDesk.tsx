"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { decideItem } from "@/app/actions/agents";
import { writeFromNews } from "@/app/actions/editorial";
import { Md } from "@/components/ui/Md";
import { useToast } from "@/components/ui/Toast";
import type { TLang } from "@/lib/team-i18n";

export type Story = { id: string; agent_key: string; kind: string; title: string; body: string; score: number | null; status: string; created_at: string; sources: { url: string; title?: string; date?: string }[] };
type Format = "linkedin" | "x" | "instagram" | "weekly" | "monthly";
const FORMATS: [Format, string, string][] = [["linkedin", "LinkedIn post", "منشور LinkedIn"], ["x", "X thread", "سلسلة X"], ["instagram", "Instagram", "إنستغرام"], ["weekly", "Weekly newsletter", "النشرة الأسبوعية"], ["monthly", "Monthly newsletter", "النشرة الشهرية"]];
const SPAN: Record<Format, number> = { linkedin: 14, x: 14, instagram: 14, weekly: 7, monthly: 31 };
const WANT: Record<Format, number> = { linkedin: 3, x: 3, instagram: 2, weekly: 8, monthly: 15 };
const STOP = new Set("a an the and or of to in on for with about from at by is are was were this that these those our we i it its as be how why what who more new".split(" "));
const words = (s: string) => s.toLowerCase().normalize("NFKD").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/**
 * The news desk: everything the scouts found, kept as an archive, and a Write tool. Pick what you're making and what
 * it's about; the archive suggests the stories that fit (matching the angle, picked ones first, then the strongest and
 * newest in the format's time window). Tick what to use, then ask the Writer or start it yourself.
 */
export function NewsDesk({ lang, stories, agents }: { lang: TLang; stories: Story[]; agents: Record<string, string> }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [format, setFormat] = useState<Format>("linkedin");
  const [out, setOut] = useState<"ar" | "en" | "both">(lang === "ar" ? "ar" : "en");
  const [angle, setAngle] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [period, setPeriod] = useState<number>(SPAN.linkedin);
  // Reading the clock once per render keeps the ranking stable while typing.
  const [now] = useState(() => Date.now());

  const suggested = useMemo(() => {
    const want = new Set(words(angle));
    const since = now - period * 864e5;
    return stories.filter((s) => s.status !== "rejected" && Date.parse(s.created_at) >= since).map((s) => {
      const text = new Set(words(`${s.title} ${s.body}`));
      const hits = [...want].filter((w) => text.has(w) || [...text].some((t) => t.startsWith(w))).length;
      const age = (now - Date.parse(s.created_at)) / 864e5;
      return { s, rank: (want.size ? hits * 4 : 0) + (s.status === "approved" ? 3 : 0) + (s.score ?? 2) * 0.6 - age * 0.05, hits };
    }).filter((x) => !want.size || x.hits > 0).sort((a, b) => b.rank - a.rank).slice(0, WANT[format] * 2).map((x) => x.s);
  }, [stories, angle, period, format, now]);

  const archive = useMemo(() => {
    const w = words(q);
    const list = stories.filter((s) => !w.length || w.every((x) => `${s.title} ${s.body}`.toLowerCase().includes(x)));
    const wk = (d: string) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const groups = new Map<string, Story[]>();
    for (const s of list) groups.set(wk(s.created_at), [...(groups.get(wk(s.created_at)) || []), s]);
    return [...groups.entries()];
  }, [stories, q]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const pick = (f: Format) => { setFormat(f); setPeriod(SPAN[f]); };
  const go = (by: "writer" | "me") => start(async () => {
    try {
      const r = await writeFromNews({ format, lang: out, angle, items: chosen, by });
      if (r.kind === "asked") toast(L("Sent to the Writer. The draft lands in Agents, Review, after the next shift.", "انرسل للكاتب. المسودة توصل الوكلاء، المراجعة، بعد الوردية الجاية."));
      else if (r.kind === "newsletter") router.push(`/team/newsletter/${r.id}`);
      else { toast(L("Added to the content calendar as a draft, with the stories in its notes.", "انضاف للتقويم كمسودة، والأخبار في ملاحظاته.")); router.push("/team/content"); }
      setChosen([]);
    } catch (e) { toast((e as Error).message); }
  });
  const row = (s: Story, compact = false) => (
    <div key={s.id} className={`nd-item${chosen.includes(s.id) ? " on" : ""}${s.status === "rejected" ? " off" : ""}`}>
      <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} aria-label={L(`Use: ${s.title}`, `استخدم: ${s.title}`)} />
      <div className="stack-t">
        <button type="button" className="nd-t" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>{s.title}</button>
        <span className="s">{agents[s.agent_key] ?? s.agent_key} · {s.created_at.slice(0, 10)}{s.status === "approved" ? ` · ${L("picked", "مختار")}` : ""}{s.sources[0] ? ` · ${host(s.sources[0].url)}` : ""}</span>
        {open === s.id ? <div className="nd-body"><Md text={s.body} className="md md-sm" />
          {s.sources.length ? <p className="s">{s.sources.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{ marginInlineEnd: ".75rem" }}>{x.title || host(x.url)}</a>)}</p> : null}
          {!compact ? <div className="row-btns">
            {s.status !== "approved" ? <button type="button" className="b quiet" disabled={pending} onClick={() => start(async () => { await decideItem({ id: s.id, action: "approve" }); router.refresh(); })}>{L("Pick", "اختر")}</button> : null}
            {s.status !== "rejected" && why !== s.id ? <button type="button" className="b ghost" onClick={() => setWhy(s.id)}>{L("Not for us", "مو لنا")}</button> : null}
          </div> : null}
          {why === s.id ? <form className="nd-row" onSubmit={(e) => { e.preventDefault(); const r = String(new FormData(e.currentTarget).get("why") || "").trim(); start(async () => { await decideItem({ id: s.id, action: "reject", feedback: r || "Not for us" }); setWhy(null); router.refresh(); }); }}>
            <label className="fld" style={{ flex: 1 }}><span>{L("Why? The scouts learn from this", "ليش؟ الراصدين يتعلمون من هذا")}</span><input name="why" autoFocus dir="auto" /></label>
            <button className="b" disabled={pending}>{L("Dismiss", "شيله")}</button>
          </form> : null}
        </div> : null}
      </div>
    </div>
  );
  return (
    <div className="nd">
      <section className="card pad nd-write">
        <h2>{L("Write something", "اكتب شي")}</h2>
        <div className="nd-formats" role="group" aria-label={L("Format", "الشكل")}>{FORMATS.map(([k, en, ar]) => <button key={k} type="button" className="pill-s" aria-pressed={format === k} onClick={() => pick(k)}>{L(en, ar)}</button>)}</div>
        <div className="nd-row">
          <label className="fld" style={{ flex: 1 }}><span>{L("What's it about? (optional)", "عن وش؟ (اختياري)")}</span><input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder={L("e.g. Saudi AI funding, women founders, Arabic LLMs", "مثلًا: تمويل الذكاء الاصطناعي في السعودية، مؤسسات، نماذج عربية")} dir="auto" /></label>
          <label className="fld"><span>{L("From the last", "من آخر")}</span><select value={period} onChange={(e) => setPeriod(Number(e.target.value))}><option value={7}>{L("week", "أسبوع")}</option><option value={14}>{L("2 weeks", "أسبوعين")}</option><option value={31}>{L("month", "شهر")}</option><option value={92}>{L("3 months", "٣ شهور")}</option></select></label>
          <label className="fld"><span>{L("Language", "اللغة")}</span><select value={out} onChange={(e) => setOut(e.target.value as "ar")}><option value="ar">العربية</option><option value="en">English</option><option value="both">{L("Both", "الاثنين")}</option></select></label>
        </div>
        <div className="nd-sug">
          <div className="nd-sug-h"><span className="sect-h" style={{ border: 0, padding: 0 }}>{L("Suggested stories", "أخبار مقترحة")}</span>
            {suggested.length ? <button type="button" className="b ghost" onClick={() => setChosen(suggested.slice(0, WANT[format]).map((s) => s.id))}>{L(`Use the top ${Math.min(WANT[format], suggested.length)}`, `استخدم أفضل ${Math.min(WANT[format], suggested.length)}`)}</button> : null}</div>
          {suggested.length ? suggested.map((s) => row(s, true)) : <p className="s">{angle ? L("Nothing in this window matches. Try other words or a longer window.", "ما فيه شي يطابق في هالفترة. جرّب كلمات ثانية أو فترة أطول.") : L("Nothing in the archive for this window yet.", "ما فيه شي في الأرشيف لهالفترة.")}</p>}
        </div>
        <div className="row-btns nd-go">
          <button type="button" className="b" disabled={pending || !chosen.length} onClick={() => go("writer")}>{L(`Ask the Writer to draft it (${chosen.length})`, `اطلب من الكاتب يكتبها (${chosen.length})`)}</button>
          <button type="button" className="b quiet" disabled={pending || !chosen.length} onClick={() => go("me")}>{L("Start it myself", "ببدأها بنفسي")}</button>
          {chosen.length ? <button type="button" className="b ghost" onClick={() => setChosen([])}>{L("Clear", "امسح")}</button> : null}
        </div>
      </section>
      <section className="nd-archive">
        <div className="nd-sug-h"><h2>{L("News archive", "أرشيف الأخبار")}</h2><input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Search the archive", "دوّر في الأرشيف")} aria-label={L("Search the archive", "دوّر في الأرشيف")} dir="auto" /></div>
        <p className="s">{L("Everything the scouts found, kept here. Nothing is published unless someone writes it.", "كل اللي لقاه الراصدين، محفوظ هنا. ما ينشر شي إلا إذا أحد كتبه.")}</p>
        {archive.length ? archive.map(([wk, list]) => (
          <div key={wk} className="card"><div className="card-h"><h2>{L("Week of", "أسبوع")} {wk}</h2><span className="key">{list.length}</span></div><div className="nd-list">{list.map((s) => row(s))}</div></div>
        )) : <div className="empty"><p style={{ margin: 0 }}>{L("Nothing yet. The scouts add news every morning.", "ما فيه شي للحين. الراصدين يضيفون أخبار كل صبح.")}</p></div>}
      </section>
    </div>
  );
}
