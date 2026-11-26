import { PhotoField, ProfileForm, RemoveTrip, SignOut, TripForm } from "@/components/members/Forms";
import { photos, requireMember } from "@/lib/members";
import { mt } from "@/lib/members-i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function Me({ searchParams }: PageProps<"/members/me">) {
  const me = await requireMember();
  const t = mt(me.lang);
  const welcome = (await searchParams).welcome;
  const { data: trips } = await (await supabaseServer()).from("member_trips").select("id,city,country,starts_on,ends_on,note").eq("member_id", me.id).gte("ends_on", new Date().toISOString().slice(0, 10)).order("starts_on");
  return (
    <div className="mb-narrow mb-stack">
      <h1 className="mb-h1">{welcome ? t.welcome : t.profile}</h1>
      {welcome ? <p className="mb-lede">{t.welcomeLede}</p> : null}
      <PhotoField t={t} src={(await photos([me]))[me.id]} has={!!me.photo_path} />
      <ProfileForm t={t} p={{ ...me, links: me.links ?? {}, role: me.role as "Engineer", looking_for: me.looking_for as never[] }} />
      <h2 className="sect-h" id="trips">{t.trips}</h2>
      {(trips || []).map((x) => <div key={x.id} className="row-btns"><span>{x.city}{x.country ? `, ${x.country}` : ""} · {x.starts_on} → {x.ends_on}{x.note ? ` · ${x.note}` : ""}</span><RemoveTrip t={t} id={x.id} /></div>)}
      <TripForm t={t} />
      <div className="mb-me-out"><SignOut t={t} /></div>
    </div>
  );
}
