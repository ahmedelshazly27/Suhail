"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewApplication, setMemberStatus, teamInvite } from "@/app/actions/members";
import { useToast } from "@/components/ui/Toast";
import { ago } from "@/lib/dates";
import { tt, type TLang } from "@/lib/team-i18n";

type App = { id: string; name: string; email: string; role: string; building: string; link: string | null; city: string; status: string; created_at: string };
type Mem = { id: string; name: string; headline: string; role: string; city: string; country: string; status: string; joined_at: string };

export function MembersAdmin({ lang, apps, members, admin, url }: { lang: TLang; apps: App[]; members: Mem[]; admin: boolean; url: string }) {
  const router = useRouter(), toast = useToast();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"apps" | "members">("apps");
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
        <button type="button" className="pill-s" aria-pressed={tab === "members"} onClick={() => setTab("members")}>{L("Members", "الأعضاء")} <span className="key">{members.filter((m) => m.status === "active").length}</span></button>
      </div>
      {tab === "apps" ? (
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
