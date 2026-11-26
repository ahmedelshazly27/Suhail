"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerRequest, importOpportunities, reviewApplication, saveOpportunity, setMemberStatus, setOpportunityPublished, teamInvite } from "@/app/actions/members";
import { useToast } from "@/components/ui/Toast";
import { ago } from "@/lib/dates";
import { tt, type TLang } from "@/lib/team-i18n";

type App = { id: string; name: string; email: string; role: string; building: string; link: string | null; city: string; status: string; created_at: string };
type Req = { id: string; kind: string; target: string; body: string; status: string; answer: string; created_at: string; member: { name: string; headline: string } | null };
type Opp = { id: string; kind: string; title: string; org: string; body: string; url: string | null; deadline: string | null; location: string; tags: string[]; published: boolean };
const KINDS = ["perk", "grant", "job", "event", "call"] as const;
type Mem = { id: string; name: string; headline: string; role: string; city: string; country: string; status: string; joined_at: string };

export function MembersAdmin({ lang, apps, members, requests, opps, admin, url }: { lang: TLang; apps: App[]; members: Mem[]; requests: Req[]; opps: Opp[]; admin: boolean; url: string }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"apps" | "requests" | "opps" | "members">("apps");
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const run = (fn: () => Promise<unknown>, msg: string) => start(async () => { try { await fn(); toast(msg); router.refresh(); } catch (e) { toast((e as Error).message); } });
  const fresh = apps.filter((a) => a.status === "new");
  return (
    <>
      <header className="ph">
        <div className="ph-t"><span className="eb">{L("The invite-only members app", "تطبيق الأعضاء بالدعوة")} · <a href={url} target="_blank" rel="noopener">{url.replace(/^https?:\/\//, "")}</a></span><h1>{tt(lang, "members")}</h1></div>
        {admin ? <form className="ph-actions" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, d = new FormData(f); run(() => teamInvite(String(d.get("email")), String(d.get("name") || "")), L("Invite sent.", "انرسلت الدعوة.")); f.reset(); }}>
          <input name="name" className="inp" placeholder={L("Name", "الاسم")} aria-label={L("Name", "الاسم")} />
          <input name="email" type="email" required className="inp" placeholder={L("Email", "الإيميل")} aria-label={L("Email", "الإيميل")} dir="ltr" />
          <button className="b" disabled={pending}>{L("Invite", "ادعُ")}</button>
        </form> : null}
      </header>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <button type="button" className="pill-s" aria-pressed={tab === "apps"} onClick={() => setTab("apps")}>{L("Applications", "الطلبات")} <span className="key">{fresh.length}</span></button>
        <button type="button" className="pill-s" aria-pressed={tab === "requests"} onClick={() => setTab("requests")}>{L("Requests", "الطلبات من الأعضاء")} <span className="key">{requests.filter((r) => r.status === "open").length}</span></button>
        <button type="button" className="pill-s" aria-pressed={tab === "opps"} onClick={() => setTab("opps")}>{L("Opportunities", "الفرص")} <span className="key">{opps.filter((o) => o.published).length}</span></button>
        <button type="button" className="pill-s" aria-pressed={tab === "members"} onClick={() => setTab("members")}>{L("Members", "الأعضاء")} <span className="key">{members.filter((m) => m.status === "active").length}</span></button>
      </div>
      {tab === "requests" ? (
        <div className="or-list">{requests.length ? requests.map((r) => (
          <form key={r.id} className="card pad" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("answer") || ""); run(() => answerRequest(r.id, v), L("Answer sent.", "انرسل الرد.")); }}>
            <span className="stack-t"><span style={{ fontWeight: 500 }}>{r.member?.name} · {r.kind}{r.target ? ` · ${r.target}` : ""}</span><span className="s">{r.member?.headline} · {ago(lang, r.created_at)}</span></span>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }} dir="auto">{r.body}</p>
            {r.status === "open" && admin ? <>
              <label className="fld"><span>{L("Answer (they get it in the app and by email)", "الرد (يوصله في التطبيق وبالإيميل)")}</span><textarea name="answer" rows={3} required dir="auto" /></label>
              <div className="row-btns"><button className="b" disabled={pending}>{L("Send answer", "أرسل الرد")}</button><button type="button" className="b ghost" disabled={pending} onClick={() => run(() => answerRequest(r.id, "", true), L("Closed.", "انقفل."))}>{L("Close without answer", "اقفله بدون رد")}</button></div>
            </> : <><span className="chip">{r.status}</span>{r.answer ? <p className="s" style={{ whiteSpace: "pre-wrap" }}>{r.answer}</p> : null}</>}
          </form>
        )) : <div className="card pad">{L("No requests yet.", "ما فيه طلبات للحين.")}</div>}</div>
      ) : tab === "opps" ? (
        <div className="or-list">
          {admin ? <form className="card pad" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, d = new FormData(f); run(() => saveOpportunity(null, { kind: d.get("kind") as "perk", title: String(d.get("title")), org: String(d.get("org")), body: String(d.get("body")), url: String(d.get("url")), deadline: String(d.get("deadline")), location: String(d.get("location")), tags: String(d.get("tags")).split(",").map((x) => x.trim()).filter(Boolean) }), L("Shared with members.", "انشاركت مع الأعضاء.")); f.reset(); }}>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>{L("Share an opportunity with members", "شارك فرصة مع الأعضاء")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: ".75rem" }}>
              <label className="fld"><span>{L("Kind", "النوع")}</span><select name="kind">{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
              <label className="fld"><span>{L("Title", "العنوان")}</span><input name="title" required maxLength={160} dir="auto" /></label>
              <label className="fld"><span>{L("Organisation", "الجهة")}</span><input name="org" maxLength={120} dir="auto" /></label>
              <label className="fld"><span>{L("Link", "الرابط")}</span><input name="url" type="url" dir="ltr" /></label>
              <label className="fld"><span>{L("Deadline", "آخر موعد")}</span><input name="deadline" type="date" /></label>
              <label className="fld"><span>{L("Location", "المكان")}</span><input name="location" maxLength={120} dir="auto" /></label>
              <label className="fld"><span>{L("Tags (match members' skills)", "وسوم (تطابق مهارات الأعضاء)")}</span><input name="tags" dir="ltr" placeholder="ai, cloud, students" /></label>
            </div>
            <label className="fld"><span>{L("Details", "التفاصيل")}</span><textarea name="body" rows={2} maxLength={3000} dir="auto" /></label>
            <div className="row-btns"><button className="b" disabled={pending}>{L("Share", "شارك")}</button>
              <button type="button" className="b quiet" disabled={pending} onClick={() => run(async () => { const n = await importOpportunities(); toast(L(`${n} added.`, `انضاف ${n}.`)); }, L("Starter list checked.", "تمت مراجعة القائمة."))}>{L("Add the starter list of credits and programs", "أضف قائمة الرصيد والبرامج")}</button></div>
          </form> : null}
          {opps.map((o) => (
            <div key={o.id} className="card pad" style={{ opacity: o.published ? 1 : .55 }}>
              <span className="stack-t"><span style={{ fontWeight: 500 }}>{o.title}</span><span className="s">{o.kind} · {o.org}{o.deadline ? ` · ${o.deadline}` : ""}{o.tags.length ? ` · ${o.tags.join(", ")}` : ""}</span></span>
              {admin ? <div className="row-btns"><button type="button" className="b ghost" disabled={pending} onClick={() => run(() => setOpportunityPublished(o.id, !o.published), tt(lang, "saved"))}>{o.published ? L("Hide from members", "أخفه عن الأعضاء") : L("Show to members", "أظهره للأعضاء")}</button></div> : null}
            </div>
          ))}
        </div>
      ) : tab === "apps" ? (
        <div className="or-list">{apps.length ? apps.map((a) => (
          <div key={a.id} className="card pad">
            <span className="stack-t"><span style={{ fontWeight: 500 }}>{a.name} · {a.role}{a.city ? ` · ${a.city}` : ""}</span><span className="s" dir="ltr">{a.email} · {ago(lang, a.created_at)}</span></span>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }} dir="auto">{a.building}</p>
            {a.link ? <a href={a.link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{a.link}</a> : null}
            {a.status === "new" && admin ? <div className="row-btns">
              <button type="button" className="b" disabled={pending} onClick={() => run(() => reviewApplication(a.id, "invite"), L("Invited.", "تمت الدعوة."))}>{L("Send invite", "أرسل دعوة")}</button>
              <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => reviewApplication(a.id, "decline"), L("Declined.", "تم الاعتذار."))}>{L("Decline", "اعتذر")}</button>
            </div> : <span className="chip">{a.status}</span>}
          </div>
        )) : <div className="card pad">{L("No applications yet.", "ما فيه طلبات للحين.")}</div>}</div>
      ) : (
        <div className="card"><div className="tbl-wrap" tabIndex={0}><table className="tbl" style={{ margin: "0 1rem", width: "calc(100% - 2rem)" }}>
          <thead><tr><th>{L("Name", "الاسم")}</th><th>{L("Role", "الدور")}</th><th>{L("Where", "وين")}</th><th>{L("Joined", "انضم")}</th><th>{L("Status", "الحالة")}</th></tr></thead>
          <tbody>{members.map((m) => (
            <tr key={m.id} style={{ cursor: "default" }}><td><span className="stack-t"><span>{m.name}</span><span className="s">{m.headline}</span></span></td><td>{m.role}</td><td>{[m.city, m.country].filter(Boolean).join(", ")}</td><td className="muted">{ago(lang, m.joined_at)}</td>
              <td>{admin ? <select value={m.status} disabled={pending} onChange={(e) => run(() => setMemberStatus(m.id, e.target.value as "active"), tt(lang, "saved"))}><option value="active">{L("Active", "نشط")}</option><option value="paused">{L("Paused", "موقوف")}</option><option value="removed">{L("Removed", "محذوف")}</option></select> : m.status}</td></tr>
          ))}</tbody>
        </table></div></div>
      )}
    </>
  );
}
