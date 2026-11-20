import Link from "next/link";
import { AgentButtons, AgentSettings, AskForm, CancelAsk, ItemCard, KeyPanel, PauseAll, type AgentRow, type ItemRow } from "@/components/team/Agents";
import { Avatar } from "@/components/ui/Avatar";
import { agentsPaused, daysAgo, POOL_KINDS, scheduleText, SHIFT_HOUR, type Agent } from "@/lib/agents";
import { isAdmin, requireMe } from "@/lib/auth";
import { getShell } from "@/lib/data/shell";
import { ago } from "@/lib/dates";
import { env } from "@/lib/env";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { tt, type TLang } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Agents" };
const TABS = ["review", "pool", "team", "asks", "runs", "connect"] as const;
type Tab = (typeof TABS)[number];
const TAB_L: Record<Tab, [string, string]> = { review: ["Review", "المراجعة"], pool: ["Pool", "الحصيلة"], team: ["The team", "الفريق"], asks: ["Requests", "الطلبات"], runs: ["Runs", "التشغيل"], connect: ["Connect", "الربط"] };
const L = (lang: TLang, en: string, ar: string) => (lang === "ar" ? ar : en);
const STATUSES = ["new", "approved", "rejected"] as const;

export default async function AgentsPage({ searchParams }: PageProps<"/team/agents">) {
  const me = await requireMe();
  const admin = isAdmin(me);
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) && (sp.tab !== "connect" || admin) ? (sp.tab as Tab) : "review";
  const who = sp.who === "all" ? "all" : "mine";
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as string) : "new";
  const only = typeof sp.agent === "string" ? sp.agent : "";
  const focus = typeof sp.item === "string" ? sp.item : "";
  const db = await supabaseServer();
  const [{ lang }, shell, { data: agentRows }, paused] = await Promise.all([teamPrefs(), getShell(me.id), db.from("agents").select("*").order("sort"), agentsPaused()]);
  const agents = (agentRows || []) as Agent[];
  const name = (k: string) => { const a = agents.find((x) => x.key === k); return a ? (lang === "ar" && a.name_ar ? a.name_ar : a.name) : k; };
  const owns = (k: string) => admin || agents.find((a) => a.key === k)?.owner_id === me.id;
  const people = shell.people.map((p) => ({ id: p.id, name: p.name }));
  const row = (a: Agent): AgentRow => ({ ...a });

  // Review queue: by default, what is waiting for me (my desks, what I asked, and for the founders the unassigned desks).
  let items: ItemRow[] = [];
  if (tab === "review") {
    let q = db.from("agent_items").select("id,agent_key,kind,title,body,data,sources,score,status,feedback,routed_type,routed_id,created_at,request_id,for_id");
    if (focus) q = q.eq("id", focus);
    else {
      q = q.eq("status", status).or(`kind.not.in.(${POOL_KINDS.join(",")}),agent_key.eq.coach`); // stories and insights live in the pool
      if (only) q = q.eq("agent_key", only);
      if (who === "mine") {
        const mine = agents.filter((a) => a.owner_id === me.id).map((a) => a.key);
        q = q.or([`for_id.eq.${me.id}`, admin ? "for_id.is.null" : "", mine.length ? `agent_key.in.(${mine.join(",")})` : ""].filter(Boolean).join(","));
      }
    }
    const { data } = await q.order("kind", { ascending: true }).order("created_at", { ascending: false }).limit(120);
    const all = (data || []) as (ItemRow & { for_id: string | null })[];
    // The latest brief first, then by score.
    items = [...all.filter((i) => i.kind === "brief").slice(0, 1), ...all.filter((i) => i.kind !== "brief").sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.created_at.localeCompare(a.created_at))];
  }

  // The pool: stories and insights from every agent, grouped by day, week or month.
  const by = sp.by === "day" || sp.by === "month" ? sp.by : "week";
  const poolStatus = sp.status === "approved" || sp.status === "rejected" ? sp.status : "new";
  let pool: ItemRow[] = [];
  if (tab === "pool") {
    let q = db.from("agent_items").select("id,agent_key,kind,title,body,data,sources,score,status,feedback,routed_type,routed_id,created_at,request_id,for_id")
      .in("kind", [...POOL_KINDS]).neq("agent_key", "coach").eq("status", poolStatus).gte("created_at", daysAgo(by === "day" ? 14 : by === "week" ? 56 : 186));
    if (only) q = q.eq("agent_key", only);
    pool = ((await q.order("created_at", { ascending: false }).limit(500)).data || []) as ItemRow[];
  }
  const period = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 3 * 3600e3); // Kuwait
    if (by === "day") return d.toISOString().slice(0, 10);
    if (by === "month") return d.toISOString().slice(0, 7);
    const sun = new Date(d); sun.setUTCDate(d.getUTCDate() - d.getUTCDay()); return sun.toISOString().slice(0, 10); // weeks start on Sunday
  };
  const fmtPeriod = (k: string) => {
    const loc = lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB";
    if (by === "month") return new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(k + "-01T00:00:00Z"));
    const f = new Intl.DateTimeFormat(loc, { weekday: by === "day" ? "long" : undefined, day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(k + "T00:00:00Z"));
    return by === "week" ? L(lang, `Week of ${f}`, `أسبوع ${f}`) : f;
  };
  const groups = [...new Set(pool.map((i) => period(i.created_at)))].map((k) => ({ k, items: pool.filter((i) => period(i.created_at) === k).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) }));

  const since = daysAgo(30);
  const [{ data: runs }, { data: decided }, { data: waiting }, { data: asks }, { data: keys }] = await Promise.all([
    tab === "team" || tab === "runs" ? db.from("agent_runs").select("id,agent_key,shift,status,summary,items,error,started_at,finished_at").order("started_at", { ascending: false }).limit(tab === "runs" ? 80 : 200) : Promise.resolve({ data: [] }),
    tab === "team" ? db.from("agent_items").select("agent_key,status").in("status", ["approved", "rejected"]).gte("decided_at", since) : Promise.resolve({ data: [] }),
    tab === "team" ? db.from("agent_items").select("agent_key").eq("status", "new") : Promise.resolve({ data: [] }),
    tab === "asks" ? db.from("agent_requests").select("id,agent_key,body,status,created_at,answered_at,created_by").order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [] }),
    tab === "connect" && admin ? supabaseAdmin().from("agent_keys").select("id,name,created_at,last_used_at,revoked_at").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const { data: answers } = tab === "asks" && (asks || []).length
    ? await db.from("agent_items").select("id,request_id").in("request_id", (asks || []).map((a) => a.id)) : { data: [] as { id: string; request_id: string }[] };
  const qs = (p: Record<string, string>) => "?" + new URLSearchParams({ tab, who, status, ...(only ? { agent: only } : {}), ...p }).toString();
  const lastRun = (k: string) => (runs || []).find((r) => r.agent_key === k);

  return (
    <div className="col">
      <div className="dither dither-strip" aria-hidden="true" />
      <header className="ph">
        <div className="ph-t">
          <span className="eb">{tt(lang, "agents")}</span>
          <h1>{L(lang, "The agent team", "فريق الوكلاء")}</h1>
          <div className="ph-meta">
            <span>{L(lang, "They research and draft on a schedule. Nothing leaves the dashboard until a person approves it.", "يدوّرون ويكتبون مسودات حسب جدول. ولا شي يطلع من لوحة الفريق إلا بعد ما يعتمده واحد منا.")}</span>
            {paused ? <span className="chip attn">{L(lang, "Paused", "موقّفين")}</span> : null}
          </div>
        </div>
        {admin ? <div className="ph-actions"><PauseAll lang={lang} paused={paused} /></div> : null}
      </header>

      <nav className="tabs-u" aria-label={tt(lang, "agents")}>
        {TABS.filter((t) => t !== "connect" || admin).map((t) => <Link key={t} href={`?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{L(lang, ...TAB_L[t])}</Link>)}
      </nav>

      {tab === "review" ? (
        <>
          {focus ? <Link href="?tab=review" className="pill-s" style={{ alignSelf: "flex-start" }}>{L(lang, "Back to the queue", "رجوع للقائمة")}</Link> : (
            <div className="ag-filters">
              <Link className="pill-s" href={qs({ who: "mine" })} aria-current={who === "mine" ? "true" : undefined}>{L(lang, "For me", "لي")}</Link>
              <Link className="pill-s" href={qs({ who: "all" })} aria-current={who === "all" ? "true" : undefined}>{L(lang, "Everyone's", "الكل")}</Link>
              <span className="faint" aria-hidden="true">·</span>
              {STATUSES.map((s) => <Link key={s} className="pill-s" href={qs({ status: s })} aria-current={status === s ? "true" : undefined}>{L(lang, { new: "To review", approved: "Approved", rejected: "Rejected" }[s], { new: "للمراجعة", approved: "المعتمد", rejected: "المرفوض" }[s])}</Link>)}
              {only ? <Link className="pill-s on" href={qs({ agent: "" }).replace(/&?agent=/, "")}>{name(only)} ×</Link> : null}
            </div>
          )}
          <div className="ag-queue">
            {items.length ? items.map((i) => <ItemCard key={i.id} lang={lang} item={i} agentName={name(i.agent_key)} canDecide={owns(i.agent_key) || (i as ItemRow & { for_id: string | null }).for_id === me.id} open={Boolean(focus)} />) : (
              <div className="empty">
                <p style={{ margin: 0 }}>{status === "new" ? L(lang, "Nothing waiting for you. New drafts arrive after each shift.", "ما فيه شي ينتظرك. المسودات الجديدة توصل بعد كل وقت تشغيل.") : tt(lang, "emptyList")}</p>
                {who === "mine" && status === "new" ? <Link className="b quiet" href={qs({ who: "all" })}>{L(lang, "See everyone's", "شوف الكل")}</Link> : null}
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "pool" ? (
        <>
          <p className="muted" style={{ margin: 0, fontSize: ".875rem", maxWidth: "44rem" }}>{L(lang, "Everything the agents find lands here. The Writer turns the best into posts and the Thursday newsletter; the Events Planner and Partner Prospector read it too. Pick what matters most; dismiss with a reason and the scouts learn.", "كل اللي يلقونه الوكلاء ينحط هني. الكاتب يحوّل الأفضل لبوستات ونشرة الخميس، ومنظّم الفعاليات وباحث الشراكات يقرونه بعد. اختار الأهم، وإذا شلت شي قول ليش عشان يتعلّمون.")}</p>
          <div className="ag-filters">
            {(["day", "week", "month"] as const).map((b) => <Link key={b} className="pill-s" href={`?tab=pool&by=${b}&status=${poolStatus}${only ? `&agent=${only}` : ""}`} aria-current={by === b ? "true" : undefined}>{L(lang, { day: "By day", week: "By week", month: "By month" }[b], { day: "باليوم", week: "بالأسبوع", month: "بالشهر" }[b])}</Link>)}
            <span className="faint" aria-hidden="true">·</span>
            {(["new", "approved", "rejected"] as const).map((st) => <Link key={st} className="pill-s" href={`?tab=pool&by=${by}&status=${st}${only ? `&agent=${only}` : ""}`} aria-current={poolStatus === st ? "true" : undefined}>{L(lang, { new: "In the pool", approved: "Picked", rejected: "Dismissed" }[st], { new: "بالحصيلة", approved: "المختار", rejected: "المشال" }[st])}</Link>)}
          </div>
          {groups.length ? groups.map((g) => (
            <section key={g.k} className="ag-queue" aria-label={fmtPeriod(g.k)}>
              <h2 className="sect-t">{fmtPeriod(g.k)} <span className="muted">· {g.items.length}</span></h2>
              {g.items.map((i) => <ItemCard key={i.id} lang={lang} item={i} agentName={name(i.agent_key)} canDecide={owns(i.agent_key)} pool />)}
            </section>
          )) : <div className="empty"><p style={{ margin: 0 }}>{L(lang, "Nothing here yet. The scouts fill the pool every morning.", "ما فيه شي للحين. الراصدين يعبّون الحصيلة كل صبح.")}</p></div>}
        </>
      ) : null}

      {tab === "team" ? (
        <div className="ag-grid">
          {agents.map((a) => {
            const r = lastRun(a.key), owner = shell.people.find((p) => p.id === a.owner_id);
            const dec = (decided || []).filter((d) => d.agent_key === a.key), ok = dec.filter((d) => d.status === "approved").length;
            const wait = (waiting || []).filter((w) => w.agent_key === a.key).length;
            return (
              <article key={a.key} className="card pad ag-card">
                <div className="kpi-h"><h2>{lang === "ar" && a.name_ar ? a.name_ar : a.name}</h2><span className="key">{a.desk}</span></div>
                <p dir="auto">{a.purpose}</p>
                <div className="ag-stats">
                  <span>{scheduleText(lang, a)}</span>
                  <span>{a.enabled ? (r ? `${L(lang, "Last run", "آخر تشغيل")} ${ago(lang, r.started_at)}${r.status === "failed" ? ` · ${L(lang, "failed", "فشل")}` : r.status === "running" ? ` · ${L(lang, "running", "شغّال")}` : ""}` : L(lang, "Not run yet", "ما اشتغل للحين")) : L(lang, "Paused", "موقّف")}</span>
                  {wait ? <Link href={`?tab=review&who=all&agent=${a.key}`}>{wait} {L(lang, "to review", "للمراجعة")}</Link> : null}
                  {dec.length ? <span>{Math.round((ok / dec.length) * 100)}% {L(lang, "approved (30 days)", "معتمد (٣٠ يوم)")}</span> : null}
                </div>
                <div className="kpi-f">
                  <span className="muted owner">{owner ? <><Avatar name={owner.name} /> {owner.name.split(" ")[0]}</> : L(lang, "Works for the founders", "يشتغل مع المؤسسين")}</span>
                </div>
                <div className="row-btns">
                  <AgentSettings lang={lang} a={row(a)} people={people} isAdmin={admin} canEdit={owns(a.key)} />
                  <AgentButtons lang={lang} a={row(a)} canEdit={owns(a.key)} />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "asks" ? (
        <div className="ag-two">
          <div className="card">
            {(asks || []).length ? (asks || []).map((r) => {
              const ans = (answers || []).find((x) => x.request_id === r.id);
              return (
                <div key={r.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div style={{ display: "grid", gap: ".25rem", minWidth: 0 }}>
                    <span dir="auto" style={{ overflowWrap: "anywhere" }}>{r.body}</span>
                    <span className="muted" style={{ fontSize: ".75rem" }}>{name(r.agent_key)} · {shell.people.find((p) => p.id === r.created_by)?.name ?? ""} · {ago(lang, r.created_at)}</span>
                  </div>
                  {r.status === "open" ? (r.created_by === me.id || owns(r.agent_key) ? <CancelAsk lang={lang} id={r.id} /> : <span className="chip">{L(lang, "Next shift", "الوقت الجاي")}</span>)
                    : ans ? <Link className="b quiet" href={`?tab=review&item=${ans.id}`}>{L(lang, "Answer", "الرد")}</Link>
                    : <span className="chip dashed">{r.status === "cancelled" ? L(lang, "Cancelled", "ملغي") : L(lang, "Answered", "انرد عليه")}</span>}
                </div>
              );
            }) : <p className="muted" style={{ padding: "1rem 1.125rem", margin: 0 }}>{L(lang, "No requests yet. Ask any agent for research or a draft; it answers at its next shift.", "ما فيه طلبات. اطلب من أي وكيل بحث أو مسودة، ويرد عليك في الوقت الجاي.")}</p>}
          </div>
          <AskForm lang={lang} agents={agents.filter((a) => a.enabled).map((a) => ({ key: a.key, name: lang === "ar" && a.name_ar ? a.name_ar : a.name }))} />
        </div>
      ) : null}

      {tab === "runs" ? (
        <div className="tbl-wrap" tabIndex={0}><table className="tbl">
          <thead><tr><th>{L(lang, "Agent", "الوكيل")}</th><th>{L(lang, "Started", "بدأ")}</th><th>{L(lang, "Status", "الحالة")}</th><th className="n">{L(lang, "Drafts", "المسودات")}</th><th>{L(lang, "Summary", "الملخص")}</th></tr></thead>
          <tbody>{(runs || []).map((r) => (
            <tr key={r.id} style={{ cursor: "default" }}>
              <td>{name(r.agent_key)}</td><td>{ago(lang, r.started_at)}</td>
              <td>{r.status === "failed" ? <span className="chip attn">{L(lang, "Failed", "فشل")}</span> : r.status === "running" ? <span className="chip">{L(lang, "Running", "شغّال")}</span> : L(lang, "Done", "خلص")}</td>
              <td className="n">{r.items}</td>
              <td dir="auto" style={{ whiteSpace: "normal", padding: ".5rem .75rem" }}>{r.error ? `${r.error}. ` : ""}{r.summary}</td>
            </tr>
          ))}</tbody>
        </table>{(runs || []).length ? null : <p className="muted">{L(lang, "No runs yet.", "ما فيه تشغيل للحين.")}</p>}</div>
      ) : null}

      {tab === "connect" && admin ? (
        <div className="ag-two">
          <section className="card pad">
            <h2>{L(lang, "How the team runs", "شلون يشتغل الفريق")}</h2>
            <ol className="ag-steps">
              <li>{L(lang, `A Claude routine on your Claude plan wakes at ${Object.values(SHIFT_HOUR).join(", ")} Kuwait time. It uses your plan, not API credits.`, `فيه مهمة مجدولة على باقة Claude حقتك تصحى الساعة ${Object.values(SHIFT_HOUR).join("، ")} بتوقيت الكويت. تستخدم باقتك، مو رصيد API.`)}</li>
              <li>{L(lang, "It asks this dashboard which agents are due, and runs each one with its own instructions, memory and the parts of the dashboard it reads.", "تسأل لوحة الفريق منو عليه الدور، وتشغّل كل وكيل بتعليماته وذاكرته والأجزاء اللي يقراها من اللوحة.")}</li>
              <li>{L(lang, "Each agent files its drafts here, in the review queue of whoever it works for. Approve sends them into Content, Newsletter, Relationships or Tickets.", "كل وكيل يحط مسوداته هني، عند الشخص اللي يشتغل معاه. لما تعتمدها تروح للمحتوى أو النشرة أو العلاقات أو المهام.")}</li>
              <li>{L(lang, "Your reasons for rejecting and your edits go into the agent's next brief, so it gets better every week.", "أسباب الرفض وتعديلاتك تدخل في تعليمات الوكيل الجاية، عشان يتحسّن كل أسبوع.")}</li>
            </ol>
            <h2>{L(lang, "The routine's instruction", "تعليمات المهمة المجدولة")}</h2>
            <code className="ag-key">{`Run: curl -sS ${env.teamUrl()}/api/agents/shift. Then do exactly what it says.`}</code>
          </section>
          <section className="card pad">
            <h2>{L(lang, "Routine key", "مفتاح المهمة")}</h2>
            <p className="muted" style={{ margin: 0, fontSize: ".8125rem" }}>{L(lang, "The routine signs in to the dashboard with this key. It can read the dashboard and file drafts, nothing else.", "المهمة تدخل لوحة الفريق بهالمفتاح. تقدر تقرا وتحط مسودات بس، ولا شي غيره.")}</p>
            <KeyPanel lang={lang} keys={keys || []} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
