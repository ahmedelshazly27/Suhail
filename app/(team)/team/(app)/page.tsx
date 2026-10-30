import Link from "next/link";
import { MyWorkCard } from "@/components/team/MyWorkCard";
import { NewTicketButton, SearchButton } from "@/components/team/PageButtons";
import { Standup } from "@/components/team/Standup";
import { Avatar } from "@/components/ui/Avatar";
import { requireMe } from "@/lib/auth";
import { ago, dueLabel, hourNow, longDate, shortTime } from "@/lib/dates";
import { getHome } from "@/lib/data/home";
import { getShell } from "@/lib/data/shell";
import { mail } from "@/lib/m365/mail";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Home" };

export default async function Home() {
  const me = await requireMe();
  const { lang } = await teamPrefs();
  const [h, shell, mp] = await Promise.all([getHome(me), getShell(me.id), mail(me.id)]);
  const boxes = await mp.mailboxes().catch(() => []);
  const msgs = (await Promise.all(boxes.slice(0, 4).map((b) => mp.list(b.id).then((l) => l.slice(0, 2).map((m) => ({ ...m, box: b.name }))).catch(() => [])))).flat().sort((a, b) => b.received.localeCompare(a.received)).slice(0, 3);
  const hr = hourNow();
  const greet = tt(lang, hr < 12 ? "goodMorning" : hr < 18 ? "goodAfternoon" : "goodEvening");
  const s = h.sprint;
  return (
    <>
      <div className="dither dither-strip" aria-hidden="true" />
      <header className="ph">
        <div className="ph-t"><span className="eb">{longDate(lang)}</span><h1>{greet}{lang === "ar" ? "، " : ", "}{me.name.split(" ")[0]}</h1></div>
        <div className="ph-actions"><SearchButton lang={lang} /><NewTicketButton lang={lang} /></div>
      </header>
      <div className="grid-3">
        <section className="col span-2">
          <MyWorkCard lang={lang} all={h.tickets} week={h.dueWeek} footer={h.expenses.length ? (
            <>{tt(lang, "expenseWaiting")}: {h.expenses.map((e) => `${e.description}${e.project ? `, ${e.project.name}` : ""}, ${e.currency} ${Number(e.amount).toLocaleString("en")}`).join(" · ")}. <Link href="/team/finance">{tt(lang, "review")}</Link></>
          ) : undefined} />
          <div className="grid-2">
            <Standup lang={lang} initial={h.standup} count={h.standupCount} total={shell.people.length} />
            <div className="card pad">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2>{tt(lang, "mentions")}</h2>
                <span className="key">{h.mentions.filter((m) => !m.read_at).length} {tt(lang, "newN")}</span>
              </div>
              {h.mentions.length ? h.mentions.map((m) => (
                <Link key={m.id} href={m.href || "/team/inbox"} style={{ display: "flex", gap: ".625rem", textDecoration: "none" }}>
                  <Avatar name={m.title.split(" ")[0]} />
                  <span className="stack-t" style={{ gap: 2 }}><span style={{ fontSize: ".8125rem" }}>{m.title}</span><span style={{ fontSize: ".8125rem", color: "var(--fg-2)" }}>{m.body}</span><span className="muted" style={{ fontSize: ".71875rem" }}>{ago(lang, m.created_at)}</span></span>
                </Link>
              )) : <p className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "noMentions")}</p>}
            </div>
          </div>
        </section>
        <aside className="col">
          <div className="band">
            <div className="dither" aria-hidden="true" />
            {s ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><h2 style={{ margin: 0, fontSize: ".875rem", fontWeight: 500 }}>{tt(lang, "sprint")} {s.number}</h2><Link href="/team/sprints" style={{ fontSize: ".75rem" }}>{tt(lang, "planSprint")} {s.next}</Link></div>
                <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem" }}><span className="big num">{s.done}</span><span className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "of")} {s.total} {tt(lang, "ofPoints")} · {tt(lang, "day")} {s.day} {tt(lang, "of")} {s.days}</span></div>
                <div className="track"><span style={{ width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%` }} /></div>
                <span className="muted" style={{ fontSize: ".75rem" }}>{s.blocked} {tt(lang, "blocked")}, {s.overdue} {tt(lang, "overdue")}</span>
              </>
            ) : (
              <><h2 style={{ margin: 0, fontSize: ".875rem", fontWeight: 500 }}>{tt(lang, "sprint")}</h2><span className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "noSprint")}</span><Link href="/team/sprints" style={{ fontSize: ".75rem" }}>{tt(lang, "startSprint")}</Link></>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h2>{tt(lang, "inbox")}</h2><Link href="/team/inbox" style={{ fontSize: ".75rem" }}>{tt(lang, "open")}</Link></div>
            {msgs.map((m) => (
              <Link key={m.id} href={`/team/inbox?mb=${encodeURIComponent(m.mailbox)}&id=${encodeURIComponent(m.id)}`} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="stack-t" style={{ gap: 2 }}><span className="s">{m.box}</span><span className="ell" style={{ fontWeight: 500 }}>{m.from}</span><span className="ell" style={{ fontSize: ".8125rem" }}>{m.subject}</span></span>
                <span className="muted" style={{ fontSize: ".75rem", alignSelf: "start" }}>{shortTime(lang, m.received)}</span>
              </Link>
            ))}
            {!mp.live ? <div className="card-f">{lang === "ar" ? "بيانات تجريبية لين يتصل Microsoft 365." : "Sample messages until Microsoft 365 is connected."}</div> : null}
          </div>
          <div className="card soft pad">
            <h2>{tt(lang, "thisWeek")}</h2>
            {h.week.length ? h.week.map((w, i) => {
              const d = dueLabel(lang, w.day);
              return <div key={i} style={{ display: "grid", gridTemplateColumns: "4rem minmax(0,1fr)", gap: ".75rem" }}><span className="due">{d.text}</span><span className="stack-t"><span className="ell" style={{ fontSize: ".8125rem" }}>{w.title}</span><span className="s">{w.meta}</span></span></div>;
            }) : <p className="muted" style={{ fontSize: ".8125rem" }}>{tt(lang, "nothingThisWeek")}</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
