import Link from "next/link";
import { MailBar, MarkAllRead, ReplyBox } from "@/components/team/MailActions";
import { Avatar } from "@/components/ui/Avatar";
import { requireMe } from "@/lib/auth";
import { ago, shortTime } from "@/lib/dates";
import { getShell } from "@/lib/data/shell";
import { mail } from "@/lib/m365/mail";
import { supabaseServer } from "@/lib/supabase/server";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Inbox" };

export default async function Inbox({ searchParams }: PageProps<"/team/inbox">) {
  const me = await requireMe();
  const sp = await searchParams;
  const db = await supabaseServer();
  const [{ lang }, shell, mp] = await Promise.all([teamPrefs(), getShell(me.id), mail(me.id)]);
  const boxes = await mp.mailboxes().catch(() => []);
  const view = typeof sp.view === "string" ? sp.view : null;
  const mb = typeof sp.mb === "string" ? sp.mb : view ? "" : boxes.find((b) => b.id !== "me" && b.unread)?.id ?? boxes[0]?.id ?? "me";
  const box = boxes.find((b) => b.id === mb);
  const { data: links } = await db.from("mail_links").select("message_id,mailbox,entity_type,entity_id,assignee_id,snoozed_until");
  const now = new Date().toISOString();
  const snoozed = new Set((links || []).filter((l) => l.snoozed_until && l.snoozed_until > now).map((l) => l.message_id));
  let list = mb ? (await mp.list(mb).catch(() => [])).filter((m) => !snoozed.has(m.id)) : [];
  const filter = typeof sp.f === "string" ? sp.f : "all";
  if (filter === "unread") list = list.filter((m) => m.unread);
  if (filter === "mine") list = list.filter((m) => links?.some((l) => l.message_id === m.id && l.assignee_id === me.id));
  if (view && view !== "notifications") {
    const all = (await Promise.all(boxes.map((b) => mp.list(b.id).catch(() => [])))).flat();
    const has = (m: { id: string }, t: string) => links?.some((l) => l.message_id === m.id && l.entity_type === t);
    list = all.filter((m) => (view === "linked" ? has(m, "relationship") : view === "tickets" ? has(m, "ticket") : !links?.some((l) => l.message_id === m.id) && m.unread));
  }
  const id = typeof sp.id === "string" ? sp.id : view === "notifications" ? null : list[0]?.id ?? null;
  const cur = id ? await mp.get(list.find((m) => m.id === id)?.mailbox ?? mb, id).catch(() => null) : null;

  const notes = view === "notifications" ? (await db.from("notifications").select("id,kind,title,body,href,read_at,created_at").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(60)).data || [] : [];
  // Context: who is this, which relationship, which tickets, what came before.
  let ctx: { rel: { id: string; name: string; type: string; stage: string; owner_id: string | null } | null; tickets: { key: string; title: string }[]; events: { what: string; happened_at: string }[]; assignee: string | null } = { rel: null, tickets: [], events: [], assignee: null };
  if (cur) {
    const domain = cur.fromEmail.split("@")[1]?.toLowerCase();
    const myLinks = (links || []).filter((l) => l.message_id === cur.id);
    const relId = myLinks.find((l) => l.entity_type === "relationship")?.entity_id
      ?? (await db.from("contacts").select("organisation_id").eq("email", cur.fromEmail).maybeSingle()).data?.organisation_id
      ?? (domain ? (await db.from("organisations").select("id").eq("domain", domain).maybeSingle()).data?.id : null);
    const rel = relId ? (await db.from("relationships").select("id,name,type,stage,owner_id").or(`id.eq.${relId},organisation_id.eq.${relId}`).limit(1).maybeSingle()).data : (await db.from("relationships").select("id,name,type,stage,owner_id").ilike("name", `%${cur.from.split(",").pop()?.trim().replace(/[[\]%]/g, "")}%`).limit(1).maybeSingle()).data;
    const tIds = myLinks.filter((l) => l.entity_type === "ticket").map((l) => l.entity_id);
    ctx = {
      rel: rel ?? null,
      tickets: tIds.length ? ((await db.from("tickets").select("key,title").in("id", tIds)).data || []) : [],
      events: rel ? ((await db.from("relationship_events").select("what,happened_at").eq("relationship_id", rel.id).order("happened_at", { ascending: false }).limit(4)).data || []) : [],
      assignee: shell.people.find((p) => p.id === (myLinks.find((l) => l.assignee_id)?.assignee_id ?? rel?.owner_id))?.name ?? null,
    };
  }
  const { data: rels } = await db.from("relationships").select("id,name").order("name");
  const q = (o: Record<string, string>) => "?" + new URLSearchParams(Object.fromEntries(Object.entries({ mb, f: filter, ...o }).filter(([, v]) => v))).toString();
  const unreadNotes = shell.counts.inbox;

  return (
    <div className={`mailwrap${cur || view === "notifications" ? " reading" : ""}`}>
      <nav className="mb-col" aria-label={tt(lang, "mailbox")}>
        <span className="side-label">{lang === "ar" ? "صناديق البريد" : "Mailboxes"}</span>
        {boxes.map((b) => <Link key={b.id} className="side-item" href={`/team/inbox?mb=${encodeURIComponent(b.id)}`} aria-current={!view && b.id === mb ? "page" : undefined}><span>{b.id === "me" ? (lang === "ar" ? "بريدي" : "My inbox") : b.name}</span>{b.unread ? <span className="n">{b.unread}</span> : null}</Link>)}
        <span className="side-label" style={{ marginTop: "1rem" }}>{lang === "ar" ? "عروض" : "Views"}</span>
        <Link className="side-item" href="/team/inbox?view=notifications" aria-current={view === "notifications" ? "page" : undefined}><span>{tt(lang, "notifications")}</span>{unreadNotes ? <span className="n">{unreadNotes}</span> : null}</Link>
        <Link className="side-item" href="/team/inbox?view=reply" aria-current={view === "reply" ? "page" : undefined}>{lang === "ar" ? "تحتاج رد" : "Needs reply"}</Link>
        <Link className="side-item" href="/team/inbox?view=linked" aria-current={view === "linked" ? "page" : undefined}>{lang === "ar" ? "مربوطة بشريك" : "Linked to a partner"}</Link>
        <Link className="side-item" href="/team/inbox?view=tickets" aria-current={view === "tickets" ? "page" : undefined}>{lang === "ar" ? "صارت مهام" : "Turned into tickets"}</Link>
        <p className="foot">{mp.live ? (lang === "ar" ? "متزامن من Outlook. الصناديق المشتركة تظهر لكل اللي عنده صلاحية في Microsoft 365." : "Synced from Outlook. Shared mailboxes show for everyone with access in Microsoft 365.") : (lang === "ar" ? "بيانات تجريبية. البريد الحقيقي يظهر بعد ربط Microsoft 365." : "Sample data. Real mail appears once Microsoft 365 is connected.")}</p>
      </nav>

      {view === "notifications" ? (
        <section className="rd-col" style={{ gridColumn: "span 3" }}>
          <div className="rd-body">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><h2>{tt(lang, "notifications")}</h2><MarkAllRead lang={lang} /></div>
            {notes.length ? <div className="card">{notes.map((n) => (
              <Link key={n.id} href={n.href || "#"} className="row" style={{ gridTemplateColumns: "8px minmax(0,1fr) auto" }}>
                <span className="dot" style={{ background: n.read_at ? "transparent" : "var(--accent)" }} aria-label={n.read_at ? undefined : "unread"} />
                <span className="stack-t"><span className="ell" style={{ fontWeight: n.read_at ? 400 : 500 }}>{n.title}</span>{n.body ? <span className="s ell">{n.body}</span> : null}</span>
                <span className="muted" style={{ fontSize: ".75rem" }}>{ago(lang, n.created_at)}</span>
              </Link>))}</div> : <p className="muted">{tt(lang, "noNotifications")}</p>}
          </div>
        </section>
      ) : (
        <>
          <section className="ml-col" aria-label={box?.name ?? ""}>
            <div className="ml-head">
              <h1>{view ? { reply: lang === "ar" ? "تحتاج رد" : "Needs reply", linked: lang === "ar" ? "مربوطة بشريك" : "Linked to a partner", tickets: lang === "ar" ? "صارت مهام" : "Turned into tickets" }[view] : box?.id === "me" ? (lang === "ar" ? "بريدي" : "My inbox") : box?.name}</h1>
              {!view ? <div style={{ display: "flex", gap: ".375rem" }}>{[["all", lang === "ar" ? "الكل" : "All"], ["unread", lang === "ar" ? "غير مقروءة" : "Unread"], ["mine", lang === "ar" ? "مسندة لي" : "Assigned to me"]].map(([k, l]) => <Link key={k} href={q({ f: k })} className="pill-s" aria-pressed={filter === k}>{l}</Link>)}</div> : null}
            </div>
            {list.map((m) => (
              <Link key={m.id} href={view ? `?view=${view}&id=${encodeURIComponent(m.id)}` : q({ id: m.id })} className={`ml-item${m.unread ? " unread" : ""}`} aria-current={cur?.id === m.id}>
                <span className="r1"><b className="ell">{m.from}</b><span className="key">{shortTime(lang, m.received)}</span></span>
                <span className="ell" style={{ fontSize: ".8125rem" }}>{m.subject}</span>
                <span className="snip">{m.snippet}</span>
              </Link>
            ))}
            {!list.length ? <p className="muted" style={{ padding: "1rem 1.125rem" }}>{tt(lang, "emptyList")}</p> : null}
          </section>
          <section className="rd-col" aria-label={cur?.subject ?? ""}>
            {cur ? (
              <>
                <MailBar lang={lang} mailbox={cur.mailbox} id={cur.id} webLink={cur.webLink} people={shell.people} projects={shell.projects} relationships={rels || []} live={mp.live} boxName={box?.name ?? ""} />
                <div className="rd-body">
                  <Link href={`/team/inbox?mb=${encodeURIComponent(mb)}`} className="m-only muted" style={{ fontSize: ".8125rem" }}>{lang === "ar" ? "→ رجوع" : "← Back"}</Link>
                  <h2 dir="auto">{cur.subject}</h2>
                  <div style={{ display: "flex", gap: ".75rem", alignItems: "center" }}><Avatar name={cur.from} size="lg" /><span className="stack-t"><span style={{ fontWeight: 500 }}>{cur.from}</span><span className="s">{lang === "ar" ? "إلى" : "to"} {box?.name ?? cur.mailbox} · {shortTime(lang, cur.received)}</span></span></div>
                  <div className="rd-text" dir="auto">{cur.bodyText}</div>
                  {cur.attachments.map((a) => (
                    <div key={a.id} className="card" style={{ display: "flex", gap: ".75rem", alignItems: "center", padding: ".75rem 1rem", maxWidth: "21.5rem", borderRadius: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /></svg>
                      <span className="stack-t"><span>{a.name}</span><span className="s">{lang === "ar" ? "احفظه في SharePoint أو أرفقه بمهمة" : "Save to SharePoint or attach to a ticket"}</span></span>
                    </div>
                  ))}
                  <ReplyBox lang={lang} mailbox={cur.mailbox} id={cur.id} boxName={box?.name ?? ""} live={mp.live} />
                </div>
              </>
            ) : <p className="muted" style={{ padding: "1.5rem" }}>{tt(lang, "emptyList")}</p>}
          </section>
          <aside className="ctx-col" aria-label={tt(lang, "context")}>
            {cur ? (
              <>
                <div><div className="sect-h">{lang === "ar" ? "الشريك" : "Partner"}</div>
                  {ctx.rel ? <Link href={`/team/relationships?id=${ctx.rel.id}`} className="card" style={{ display: "block", padding: ".75rem .875rem", borderRadius: 0, textDecoration: "none" }}><b style={{ fontWeight: 500 }}>{ctx.rel.name}</b><br /><span className="muted" style={{ fontSize: ".75rem" }}>{ctx.rel.type} · {ctx.rel.stage}{ctx.rel.owner_id ? ` · ${lang === "ar" ? "المسؤول" : "owner"} ${shell.people.find((p) => p.id === ctx.rel!.owner_id)?.name.split(" ")[0] ?? ""}` : ""}</span></Link> : <span className="muted">{lang === "ar" ? "مو مربوط" : "Not linked"}</span>}</div>
                {ctx.tickets.length ? <div><div className="sect-h">{lang === "ar" ? "مهام مرتبطة" : "Linked tickets"}</div>{ctx.tickets.map((t) => <Link key={t.key} href={`/team/tickets/${t.key}`} style={{ display: "grid", gridTemplateColumns: "3.5rem minmax(0,1fr)", gap: ".5rem", textDecoration: "none" }}><span className="key">{t.key}</span><span>{t.title}</span></Link>)}</div> : null}
                {ctx.assignee ? <div><div className="sect-h">{lang === "ar" ? "المسؤول" : "Assigned"}</div>{ctx.assignee.split(" ")[0]}</div> : null}
                {ctx.events.length ? <div><div className="sect-h">{lang === "ar" ? "تواصل سابق" : "Earlier with them"}</div>{ctx.events.map((e, i) => <div key={i}>{new Intl.DateTimeFormat(lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { day: "numeric", month: "short" }).format(new Date(e.happened_at))} · {e.what}</div>)}</div> : null}
              </>
            ) : null}
          </aside>
        </>
      )}
    </div>
  );
}
