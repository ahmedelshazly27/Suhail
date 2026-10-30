import { CreateSprint } from "@/components/team/CreateSprint";
import { SprintPlanner, StartSprint } from "@/components/team/SprintPlanner";
import { requireMe } from "@/lib/auth";
import { ticketCtx } from "@/lib/data/ctx";
import { listTickets } from "@/lib/data/tickets";
import { calendar } from "@/lib/m365/calendar";
import { tt } from "@/lib/team-i18n";

export const metadata = { title: "Sprints" };
const range = (lang: "ar" | "en", a: string, b: string) => {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { ...o, timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  return lang === "ar" ? `${f(a, { day: "numeric" })} إلى ${f(b, { day: "numeric", month: "long" })}` : `${f(a, { day: "numeric" })} to ${f(b, { day: "numeric", month: "long" })}`;
};

export default async function Sprints() {
  const me = await requireMe();
  const ctx = await ticketCtx(me);
  const { lang, sprints, people } = ctx;
  const active = sprints.find((s) => s.status === "active") ?? null;
  const planning = sprints.find((s) => s.status === "planned") ?? null;
  if (!planning) return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">{tt(lang, "sprints")} / {lang === "ar" ? "التخطيط" : "Planning"}</span><h1>{active ? `${tt(lang, "sprint")} ${active.number} · ${range(lang, active.starts_on, active.ends_on)}` : tt(lang, "sprints")}</h1></div><CreateSprint lang={lang} /></header>
      <p className="muted">{lang === "ar" ? "أنشئ الدورة الجاية عشان تخطّط لها." : "Create the next sprint to plan it."}</p>
    </>
  );
  const [backlog, planned, unfinished, cal] = await Promise.all([
    listTickets({ sprint: "none", status: ["backlog", "todo", "in_progress", "in_review"] }),
    listTickets({ sprint: planning.id }),
    active ? listTickets({ sprint: active.id, status: ["backlog", "todo", "in_progress", "in_review"] }) : Promise.resolve([]),
    calendar(me.id),
  ]);
  const away = await cal.awayDays(people.map((p) => p.email), planning.starts_on + "T00:00:00", planning.ends_on + "T23:59:59").catch(() => ({} as Record<string, number>));
  const { data: caps } = await (await import("@/lib/supabase/server")).supabaseServer().then((db) => db.from("profiles").select("id,capacity").eq("active", true));
  const capacity = people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar_url, cap: caps?.find((c) => c.id === p.id)?.capacity ?? 8, away: Math.round((away[p.email.toLowerCase()] ?? 0) * 0.8), planned: 0 }));
  return (
    <>
      <header className="ph">
        <div className="ph-t"><span className="eb">{tt(lang, "sprints")} / {lang === "ar" ? "التخطيط" : "Planning"}</span><h1>{tt(lang, "sprint")} {planning.number} · {range(lang, planning.starts_on, planning.ends_on)}</h1></div>
        <div className="ph-actions">{cal.live ? <span className="search-btn" style={{ minWidth: 0, color: "var(--fg)" }}>{lang === "ar" ? "التخطيط والمراجعة في تقويم Teams" : "Planning and review added to Teams calendar"}</span> : null}<StartSprint id={planning.id} lang={lang} label={`Start sprint ${planning.number}`} /></div>
      </header>
      <SprintPlanner lang={lang} sprint={{ id: planning.id, number: planning.number }} active={active ? { id: active.id, number: active.number } : null} unfinished={unfinished.length}
        backlog={backlog} planned={planned} people={people} projects={ctx.projects} capacity={capacity} calendarLive={cal.live} />
    </>
  );
}
