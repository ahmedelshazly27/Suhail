import { InviteMaker } from "@/components/members/Forms";
import { INVITES_PER_MEMBER, memberLink, requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Invite" };

export default async function Invite() {
  const me = await requireMember();
  const t = mt(me.lang);
  const { data } = await (await supabaseServer()).from("member_invites").select("code,email,used_by,used_at,expires_at,created_at").eq("created_by_member", me.id).order("created_at", { ascending: false });
  const remaining = INVITES_PER_MEMBER - (data?.length ?? 0);
  return (
    <div className="mb-narrow mb-stack">
      <h1 className="mb-h1">{t.invite}</h1>
      <p className="mb-lede">{t.inviteLede}</p>
      <p><strong>{remaining}</strong> {t.invitesLeft}</p>
      <InviteMaker t={t} remaining={remaining} />
      <div className="card">{(data || []).map((i) => (
        <div key={i.code} className="row mb-post-row"><code dir="ltr" className="ell">{memberLink(`/members/join/${i.code}`)}</code><span className="s" dir="ltr">{i.email ?? ""}</span><span className="chip">{i.used_at ? t.used : `${t.expires} ${i.expires_at.slice(0, 10)}`}</span></div>
      ))}</div>
    </div>
  );
}
