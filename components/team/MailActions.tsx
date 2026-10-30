"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignMail, linkMailToRelationship, replyToMail, snoozeMail, ticketFromMail } from "@/app/actions/mail";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";
import type { Person, ProjectLite } from "@/lib/data/shell";

type P = { lang: TLang; mailbox: string; id: string; webLink: string; people: Person[]; projects: ProjectLite[]; relationships: { id: string; name: string }[]; live: boolean; boxName: string };

export function MailBar({ lang, mailbox, id, webLink, people, projects, relationships }: P) {
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => { try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message || tt(lang, "error")); } });
  const sel = (label: string, opts: { id: string; name: string }[], on: (v: string) => void) => (
    <label className="b quiet" style={{ gap: ".25rem" }}>{label}<select value="" aria-label={label} style={{ border: 0, background: "transparent", appearance: "none", width: ".75rem" }} onChange={(e) => e.target.value && on(e.target.value)}><option value="">▾</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  );
  return (
    <div className="rd-bar">
      <div className="dither dither-corner" aria-hidden="true" style={{ width: "16rem", height: "100%" }} />
      <a className="b" href="#reply" onClick={() => setTimeout(() => document.getElementById("reply-box")?.focus(), 30)}>{tt(lang, "reply")}</a>
      {sel(tt(lang, "createTicket"), [{ id: "none", name: tt(lang, "noProject") }, ...projects.map((p) => ({ id: p.id, name: p.name }))], (pid) => run(async () => { const t = await ticketFromMail({ mailbox, id, project_id: pid === "none" ? null : pid }); router.push(`/team/tickets/${t.key}`); }, tt(lang, "saved")))}
      {sel(tt(lang, "linkPartner"), relationships, (rid) => run(() => linkMailToRelationship({ mailbox, id, relationship_id: rid }), tt(lang, "saved")))}
      {sel(tt(lang, "assign"), people.map((p) => ({ id: p.id, name: p.name })), (pid) => run(() => assignMail({ mailbox, id, assignee: pid }), tt(lang, "saved")))}
      {sel(tt(lang, "snooze"), [{ id: "1", name: lang === "ar" ? "يوم" : "1 day" }, { id: "3", name: lang === "ar" ? "٣ أيام" : "3 days" }, { id: "7", name: lang === "ar" ? "أسبوع" : "1 week" }], (d) => run(() => snoozeMail({ mailbox, id, days: Number(d) }), tt(lang, "saved")))}
      <a href={webLink} target="_blank" rel="noreferrer" style={{ marginInlineStart: "auto", fontSize: ".8125rem", color: "var(--st-review)" }}>{tt(lang, "openOutlook")}</a>
    </div>
  );
}

export function ReplyBox({ lang, mailbox, id, boxName, live }: { lang: TLang; mailbox: string; id: string; boxName: string; live: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form id="reply" className="card" style={{ borderRadius: 0, marginTop: "auto", maxWidth: "26.5rem" }} onSubmit={(e) => { e.preventDefault(); start(async () => { try { await replyToMail({ mailbox, id, text }); setText(""); toast(lang === "ar" ? "انرسل الرد" : "Reply sent"); } catch (err) { toast((err as Error).message); } }); }}>
      <div className="card-f" style={{ borderBottom: "1px solid var(--line)" }}>{lang === "ar" ? `الرد من ${boxName} · يمشي عبر Outlook ويوصل للمرسل` : `Reply from ${boxName} · sends through Outlook, lands in Sent`}</div>
      <textarea id="reply-box" className="inp" style={{ border: 0, minHeight: "5.5rem", resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === "ar" ? "اكتب ردك…" : "Write a reply…"} aria-label={tt(lang, "reply")} />
      {text ? <div style={{ display: "flex", justifyContent: "flex-end", padding: ".5rem" }}><button className="b" type="submit" disabled={pending || !live}>{tt(lang, "send")}</button></div> : null}
      {!live && text ? <div className="card-f">{lang === "ar" ? "الردود تشتغل بعد ربط Microsoft 365." : "Replies work once Microsoft 365 is connected."}</div> : null}
    </form>
  );
}

export function MarkAllRead({ lang }: { lang: TLang }) {
  const [, start] = useTransition();
  const router = useRouter();
  return <button type="button" className="linkbtn" onClick={() => start(async () => { const { markNotificationsRead } = await import("@/app/actions/mail"); await markNotificationsRead(); router.refresh(); })}>{tt(lang, "markRead")}</button>;
}
