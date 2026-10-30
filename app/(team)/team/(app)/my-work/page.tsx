import Link from "next/link";
import { TicketsView } from "@/components/team/TicketsView";
import { requireMe } from "@/lib/auth";
import { ticketCtx } from "@/lib/data/ctx";
import { listTickets } from "@/lib/data/tickets";
import { getView } from "@/lib/data/views";
import { supabaseServer } from "@/lib/supabase/server";
import { tt } from "@/lib/team-i18n";
import { addDays, todayISO } from "@/lib/dates";

export const metadata = { title: "My work" };

/** Everything assigned to me: tickets, applications I'm reviewing, and approvals waiting on me. */
export default async function MyWork() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [ctx, tickets, view, apps] = await Promise.all([
    ticketCtx(me), listTickets({ assignee: me.id, status: ["backlog", "todo", "in_progress", "in_review", "done"] }), getView(me.id, "my-work", { layout: "list", group_by: "status", filters: {}, sort: [] }),
    db.from("applications").select("id,name,email,stage,form_key,role:roles(plain_en,plain_ar)").eq("assignee_id", me.id).is("deleted_at", null).not("stage", "in", "(Joined,\"Not now\",Done)").order("created_at", { ascending: false }),
  ]);
  const { lang } = ctx;
  return (
    <>
      <header className="ph"><div className="ph-t"><span className="eb">{me.name}</span><h1>{tt(lang, "myWork")}</h1></div></header>
      <TicketsView tickets={tickets.filter((t) => t.status !== "done" || (t.due_on ?? "") > addDays(todayISO(), -7))} ctx={ctx} list="my-work" view={view} defaults={{}} hideDone />
      {apps.data?.length ? (
        <div className="card">
          <div className="card-h"><h2>{tt(lang, "applications")}</h2><span className="key">{apps.data.length}</span></div>
          {apps.data.map((a) => { const r = a.role as unknown as { plain_en: string; plain_ar: string } | null; return (
            <Link key={a.id} href={`/team/applications/${a.id}`} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span className="stack-t"><span className="ell">{a.name || a.email}</span><span className="s">{r ? (lang === "ar" ? r.plain_ar : r.plain_en) : a.form_key}</span></span><span className="chip">{a.stage}</span>
            </Link>); })}
        </div>
      ) : null}
    </>
  );
}
