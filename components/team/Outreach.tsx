"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { importOutreach, saveOutreach, sendOutreach } from "@/app/actions/outreach";
import { Md } from "@/components/ui/Md";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";

export type OutRow = {
  id: string; relationship_id: string; segment: string; priority: number; country: string; website: string | null;
  why_them: string; why_us: string; ask: string; programs: string[]; sources: string[];
  contact_name: string | null; contact_role: string | null; linkedin: string | null; email_source: string | null; form_url: string | null;
  subject: string; body: string; status: "ready" | "drafted" | "sent" | "skipped"; sent_at: string | null;
  rel: { name: string; stage: string; type: string; email: string | null };
};

const STATUS = ["ready", "drafted", "sent", "skipped"] as const;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function Card({ lang, o, canEmail, open, onToggle }: { lang: TLang; o: OutRow; canEmail: boolean; open: boolean; onToggle: () => void }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const done = o.status === "sent";
  const go = (f: HTMLFormElement, send: boolean) => {
    if (!f.reportValidity()) return;
    const d = new FormData(f);
    start(async () => {
      try {
        const res = await sendOutreach({ id: o.id, to: String(d.get("to")), subject: String(d.get("subject")), body: String(d.get("body")), send });
        toast(send ? L(`Sent to ${o.rel.name} from your Outlook.`, `انرسل إلى ${o.rel.name} من Outlook حقك.`) : L("Saved in your Outlook Drafts.", "انحفظ في مسودات Outlook."));
        if (!send && res.webLink) window.open(res.webLink, "_blank", "noopener");
        router.refresh();
      } catch (e) { toast((e as Error).message || tt(lang, "error")); }
    });
  };
  const set = (patch: Parameters<typeof saveOutreach>[1], msg?: string) => start(async () => { await saveOutreach(o.id, patch); if (msg) toast(msg); router.refresh(); });
  return (
    <article className={`card or-card${open ? " open" : ""}`} data-status={o.status}>
      <button type="button" className="or-head" aria-expanded={open} onClick={onToggle}>
        <span className={`or-p p${o.priority}`} title={L("Priority", "الأولوية")}>P{o.priority}</span>
        <span className="stack-t"><span className="or-name">{o.rel.name}</span><span className="s">{[o.segment, o.country].filter(Boolean).join(" · ")}</span></span>
        {o.ask.startsWith("Before sending") && o.status === "ready" ? <span className="chip attn">{L("File the form first", "عبّ النموذج أول")}</span> : <span className="s or-to" dir="ltr">{o.rel.email ?? (o.form_url ? L("contact form", "نموذج تواصل") : L("no public address", "ما فيه عنوان منشور"))}</span>}
        <span className={`chip${o.status === "ready" ? " attn" : ""}`}>{({ ready: L("Ready", "جاهز"), drafted: L("In Drafts", "في المسودات"), sent: L("Sent", "انرسل"), skipped: L("Skipped", "متجاوز") })[o.status]}</span>
      </button>
      {open ? (
        <div className="or-body">
          <div className="or-why">
            <div><span className="sect-h">{L("Why them", "ليش هم")}</span><Md text={o.why_them} className="md md-sm" /></div>
            <div><span className="sect-h">{L("What we offer them", "وش نقدّم لهم")}</span><Md text={o.why_us} className="md md-sm" /></div>
            <div><span className="sect-h">{L("First ask", "أول طلب")}</span><Md text={o.ask} className="md md-sm" />{o.programs.length ? <span className="s">{o.programs.join(" · ")}</span> : null}</div>
          </div>
          <div className="or-contact">
            <span className="stack-t"><span>{o.contact_name ?? L("No named person yet", "ما فيه شخص محدد")}{o.contact_role ? ` · ${o.contact_role}` : ""}</span>
              <span className="s or-links">
                {o.linkedin ? <a href={o.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a> : null}
                {o.website ? <a href={o.website} target="_blank" rel="noopener noreferrer">{host(o.website)}</a> : null}
                {o.form_url ? <a href={o.form_url} target="_blank" rel="noopener noreferrer">{L("Contact form", "نموذج التواصل")}</a> : null}
                {o.email_source ? <a href={o.email_source} target="_blank" rel="noopener noreferrer">{L("Where the address is published", "وين العنوان منشور")}</a> : null}
                <Link href={`/team/relationships?id=${o.relationship_id}`}>{L("Open in Relationships", "افتحه في العلاقات")}</Link>
              </span></span>
          </div>
          <form className="or-form" onSubmit={(e) => { e.preventDefault(); go(e.currentTarget, true); }}>
            <label className="fld"><span>{L("To", "إلى")}</span><input name="to" type="email" required dir="ltr" defaultValue={o.rel.email ?? ""} disabled={done} placeholder={L("Paste an address they published", "حط عنوان نشروه")} /></label>
            <label className="fld"><span>{L("Subject", "الموضوع")}</span><input name="subject" required maxLength={200} dir="auto" defaultValue={o.subject} disabled={done} onBlur={(e) => e.target.value.trim() && e.target.value !== o.subject && set({ subject: e.target.value })} /></label>
            <label className="fld"><span>{L("Message", "الرسالة")}</span><textarea name="body" required rows={9} dir="auto" defaultValue={o.body} disabled={done} onBlur={(e) => e.target.value.trim() && e.target.value !== o.body && set({ body: e.target.value })} /></label>
            {done ? <p className="s">{L("Sent. Replies arrive in your Outlook and on the relationship.", "انرسل. الردود توصل Outlook حقك وتنضاف للعلاقة.")}</p> : (
              <div className="row-btns">
                <button className="b" disabled={pending || !canEmail} title={canEmail ? undefined : L("Works once Microsoft 365 is connected", "يشتغل بعد ربط Microsoft 365")}>{pending ? L("Sending…", "جاري الإرسال…") : L("Send from Outlook", "أرسل من Outlook")}</button>
                <button type="button" className="b quiet" disabled={pending || !canEmail} onClick={(e) => go(e.currentTarget.form!, false)}>{L("Save to Drafts", "احفظ في المسودات")}</button>
                {o.status === "skipped"
                  ? <button type="button" className="b ghost" disabled={pending} onClick={() => set({ status: "ready" })}>{L("Bring back", "رجّعه")}</button>
                  : <button type="button" className="b ghost" disabled={pending} onClick={() => set({ status: "skipped" }, L("Skipped.", "تم التجاوز."))}>{L("Skip", "تجاوز")}</button>}
              </div>
            )}
          </form>
          {o.sources.length ? <p className="s or-src">{L("Sources", "المصادر")}: {o.sources.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer">{host(u)}</a>)}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export function Outreach({ lang, rows, packSize, admin, canEmail, signature }: { lang: TLang; rows: OutRow[]; packSize: number; admin: boolean; canEmail: boolean; signature: string }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<(typeof STATUS)[number]>("ready");
  const [segment, setSegment] = useState("all");
  const [withEmail, setWithEmail] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const segments = useMemo(() => [...new Set(rows.map((r) => r.segment).filter(Boolean))].sort(), [rows]);
  const shown = rows.filter((r) => r.status === status && (segment === "all" || r.segment === segment) && (!withEmail || r.rel.email))
    .sort((a, b) => a.priority - b.priority || Number(!a.rel.email) - Number(!b.rel.email) || a.rel.name.localeCompare(b.rel.name));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <header className="ph">
        <div className="ph-t"><span className="eb">{L("Researched partners, each with a ready email", "شركاء مدروسين، لكل واحد إيميل جاهز")}</span><h1>{tt(lang, "outreach")}</h1></div>
        <div className="ph-actions">
          {admin && packSize ? <button type="button" className="b" disabled={pending} onClick={() => start(async () => {
            try { const r = await importOutreach(); toast(L(`Imported: ${r.added} new, ${r.updated} updated.`, `تم: ${r.added} جديد، ${r.updated} محدّث.`)); router.refresh(); } catch (e) { toast((e as Error).message); }
          })}>{pending ? L("Importing…", "جاري الاستيراد…") : rows.length ? L(`Refresh research (${packSize})`, `حدّث البحث (${packSize})`) : L(`Import ${packSize} researched partners`, `استورد ${packSize} شريك مدروس`)}</button> : null}
        </div>
      </header>
      <p className="s" style={{ maxWidth: "62ch" }}>{L("Every email goes out from your own Outlook, so it sits in your Sent Items and replies come back to you. Addresses are only ones the organisation or person published; where there is none, use the contact form or LinkedIn, or paste an address you have.", "كل إيميل يطلع من Outlook حقك، فيكون في الصادر والردود ترجع لك. العناوين بس اللي نشرتها الجهة أو الشخص؛ إذا ما فيه، استخدم نموذج التواصل أو LinkedIn، أو حط عنوان عندك.")}</p>
      <details className="sig-box"><summary>{L("Your signature, added to every email", "توقيعك، ينضاف لكل إيميل")}</summary><pre className="sig-prev">{signature}</pre></details>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
        {STATUS.map((s) => <button key={s} type="button" className="pill-s" aria-pressed={status === s} onClick={() => setStatus(s)}>{({ ready: L("Ready", "جاهز"), drafted: L("In Drafts", "في المسودات"), sent: L("Sent", "انرسل"), skipped: L("Skipped", "متجاوز") })[s]} <span className="key">{count(s)}</span></button>)}
        <select className="pill-s" value={segment} onChange={(e) => setSegment(e.target.value)} aria-label={L("Segment", "الفئة")}><option value="all">{L("All segments", "كل الفئات")}</option>{segments.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="pill-s"><input type="checkbox" checked={withEmail} onChange={(e) => setWithEmail(e.target.checked)} /> {L("With an address", "فيه عنوان")}</label>
      </div>
      {rows.length === 0 ? <div className="card" style={{ padding: "1.25rem" }}>{admin ? L("Nothing here yet. Import the researched partners to start.", "ما فيه شي للحين. استورد الشركاء المدروسين عشان تبدأ.") : L("Nothing here yet. An admin can import the researched partners.", "ما فيه شي للحين. المدير يقدر يستورد الشركاء.")}</div>
        : shown.length === 0 ? <div className="card" style={{ padding: "1.25rem" }}>{L("Nothing in this list.", "القائمة فاضية.")}</div>
        : <div className="or-list">{shown.map((o) => <Card key={o.id} lang={lang} o={o} canEmail={canEmail} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />)}</div>}
    </>
  );
}
