import { AskForm } from "@/components/members/Forms";
import { requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Ask Suhail" };

export default async function Ask() {
  const me = await requireMember();
  const t = mt(me.lang);
  const { data } = await (await supabaseServer()).from("member_requests").select("id,kind,target,body,status,answer,created_at").eq("member_id", me.id).order("created_at", { ascending: false });
  return (
    <div className="mb-narrow mb-stack">
      <h1 className="mb-h1">{t.ask}</h1>
      <p className="mb-lede">{t.askLede}</p>
      <AskForm t={t} />
      {data?.length ? <><h2 className="sect-h">{t.yourAsks}</h2>{data.map((r) => (
        <div key={r.id} className="card pad">
          <span className="mb-post-k"><span className="chip">{t.askKinds[r.kind]}</span>{r.target ? <span className="s">{r.target}</span> : null}<span className={`chip${r.status === "answered" ? " attn" : ""}`}>{r.status === "answered" ? t.answered : r.status === "closed" ? t.closed : t.open}</span></span>
          <p dir="auto" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.body}</p>
          {r.answer ? <p className="mb-ok" dir="auto" style={{ whiteSpace: "pre-wrap" }}>{r.answer}</p> : null}
        </div>
      ))}</> : null}
    </div>
  );
}
