"use client";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  addComment, addTrip, applyForMembership, createInvite, createPost, decideIntro, deletePost, introContacts, joinWithInvite,
  memberSignOut, removeTrip, requestIntro, saveProfile, sendMemberLink, setMemberLang, toggle,
} from "@/app/actions/members";
import { mt, type MLang } from "@/lib/members-i18n";

type T = ReturnType<typeof mt>;
const Err = ({ msg }: { msg: string | null }) => (msg ? <p className="mb-err" role="alert">{msg}</p> : null);
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => start(async () => { setErr(null); try { await fn(); after?.(); router.refresh(); } catch (e) { setErr((e as Error).message); } });
  return { pending, err, run };
}

export function LangToggle({ lang }: { lang: MLang }) {
  const { run, pending } = useRun();
  return <button type="button" className="mb-lang" disabled={pending} onClick={() => run(() => setMemberLang(lang === "ar" ? "en" : "ar"))}>{mt(lang).language}</button>;
}
export function SignOut({ t }: { t: T }) {
  return <form action={memberSignOut}><button className="b ghost">{t.signOut}</button></form>;
}

export function LinkForm({ t }: { t: T }) {
  const [state, act, pending] = useActionState(sendMemberLink, null);
  if (state?.ok) return <p className="mb-ok" role="status">{t.linkSent}</p>;
  return (
    <form action={act} className="mb-form">
      <label className="fld"><span>{t.email}</span><input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
      <button className="b" disabled={pending}>{t.sendLink}</button>
      <Err msg={state && !state.ok ? (t as Record<string, unknown>)[state.msg ?? "error"] as string ?? t.error : null} />
    </form>
  );
}

export function JoinForm({ t, code, email }: { t: T; code: string; email: string | null }) {
  const [state, act, pending] = useActionState(joinWithInvite, null);
  if (state?.ok) return <p className="mb-ok" role="status">{t.linkSent}</p>;
  return (
    <form action={act} className="mb-form">
      <input type="hidden" name="code" value={code} />
      <label className="fld"><span>{t.name}</span><input name="name" required maxLength={120} autoComplete="name" /></label>
      <label className="fld"><span>{t.email}</span><input name="email" type="email" required dir="ltr" defaultValue={email ?? ""} readOnly={!!email} autoComplete="email" /></label>
      <button className="b" disabled={pending}>{t.joinSend}</button>
      <Err msg={state && !state.ok ? (state.msg === "badInvite" ? t.badInvite : t.error) : null} />
    </form>
  );
}

export function ApplyForm({ t }: { t: T }) {
  const [state, act, pending] = useActionState(applyForMembership, null);
  if (state?.ok) return <p className="mb-ok" role="status">{t.applied}</p>;
  return (
    <form action={act} className="mb-form">
      <label className="fld"><span>{t.name}</span><input name="name" required maxLength={120} autoComplete="name" /></label>
      <label className="fld"><span>{t.email}</span><input name="email" type="email" required dir="ltr" autoComplete="email" /></label>
      <label className="fld"><span>{t.role}</span><select name="role">{Object.entries(t.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="fld"><span>{t.building}</span><textarea name="building" required minLength={10} maxLength={1500} rows={5} dir="auto" /></label>
      <label className="fld"><span>{t.link}</span><input name="link" type="url" dir="ltr" placeholder="https://" /></label>
      <label className="fld"><span>{t.city}</span><input name="city" maxLength={80} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="vh-sr" />
      <button className="b" disabled={pending}>{t.applySend}</button>
      <Err msg={state && !state.ok ? t.error : null} />
    </form>
  );
}

type Profile = Parameters<typeof saveProfile>[0];
export function ProfileForm({ t, p }: { t: T; p: Profile }) {
  const { run, pending, err } = useRun();
  const [saved, setSaved] = useState(false);
  return (
    <form className="mb-form" onSubmit={(e) => {
      e.preventDefault(); const d = new FormData(e.currentTarget);
      run(() => saveProfile({
        name: String(d.get("name")), headline: String(d.get("headline")), building: String(d.get("building")), role: d.get("role") as Profile["role"],
        company: String(d.get("company")), city: String(d.get("city")), country: String(d.get("country")),
        skills: String(d.get("skills")).split(",").map((s) => s.trim()).filter(Boolean), looking_for: d.getAll("looking_for") as Profile["looking_for"],
        open_to_intros: d.get("open") === "on", links: { linkedin: String(d.get("linkedin")), x: String(d.get("x")), github: String(d.get("github")), site: String(d.get("site")) },
      }), () => setSaved(true));
    }}>
      <label className="fld"><span>{t.name}</span><input name="name" required maxLength={120} defaultValue={p.name} /></label>
      <label className="fld"><span>{t.headline}</span><input name="headline" maxLength={160} defaultValue={p.headline} placeholder={t.headlinePh} dir="auto" /></label>
      <div className="mb-2col">
        <label className="fld"><span>{t.role}</span><select name="role" defaultValue={p.role}>{Object.entries(t.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="fld"><span>{t.company}</span><input name="company" maxLength={120} defaultValue={p.company} dir="auto" /></label>
        <label className="fld"><span>{t.city}</span><input name="city" maxLength={80} defaultValue={p.city} dir="auto" /></label>
        <label className="fld"><span>{t.country}</span><input name="country" maxLength={80} defaultValue={p.country} dir="auto" /></label>
      </div>
      <label className="fld"><span>{t.building}</span><textarea name="building" rows={4} maxLength={1200} defaultValue={p.building} dir="auto" /></label>
      <label className="fld"><span>{t.skills}</span><input name="skills" defaultValue={p.skills.join(", ")} placeholder={t.skillsPh} dir="ltr" /></label>
      <fieldset className="fld mb-checks"><legend>{t.lookingFor}</legend>{Object.entries(t.looking).map(([k, v]) => <label key={k} className="pill-s"><input type="checkbox" name="looking_for" value={k} defaultChecked={p.looking_for.includes(k as never)} /> {v}</label>)}</fieldset>
      <fieldset className="fld"><legend>{t.linksH}</legend><div className="mb-2col">
        {(["linkedin", "x", "github", "site"] as const).map((k) => <label key={k} className="fld"><span>{k === "site" ? "Website" : k === "x" ? "X" : k === "github" ? "GitHub" : "LinkedIn"}</span><input name={k} type="url" dir="ltr" placeholder="https://" defaultValue={p.links[k] ?? ""} /></label>)}
      </div></fieldset>
      <label className="pill-s" style={{ alignSelf: "flex-start" }}><input type="checkbox" name="open" defaultChecked={p.open_to_intros} /> {t.openIntros}</label>
      <div className="row-btns"><button className="b" disabled={pending}>{t.save}</button>{saved && !pending ? <span className="mb-ok-s" role="status">{t.saved}</span> : null}</div>
      <Err msg={err} />
    </form>
  );
}

export function TripForm({ t }: { t: T }) {
  const { run, pending, err } = useRun();
  return (
    <form className="mb-form mb-trip" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, d = new FormData(f); run(() => addTrip({ city: String(d.get("city")), country: String(d.get("country")), starts_on: String(d.get("from")), ends_on: String(d.get("to")), note: String(d.get("note")) }), () => f.reset()); }}>
      <label className="fld"><span>{t.city}</span><input name="city" required maxLength={80} dir="auto" /></label>
      <label className="fld"><span>{t.country}</span><input name="country" maxLength={80} dir="auto" /></label>
      <label className="fld"><span>{t.from}</span><input name="from" type="date" required /></label>
      <label className="fld"><span>{t.to}</span><input name="to" type="date" required /></label>
      <label className="fld"><span>{t.note}</span><input name="note" maxLength={200} dir="auto" /></label>
      <button className="b" disabled={pending}>{t.addTrip}</button>
      <Err msg={err} />
    </form>
  );
}
export function RemoveTrip({ t, id }: { t: T; id: string }) {
  const { run, pending } = useRun();
  return <button type="button" className="b ghost" disabled={pending} onClick={() => run(() => removeTrip(id))}>{t.remove}</button>;
}

export function PostForm({ t }: { t: T }) {
  const router = useRouter();
  const { run, pending, err } = useRun();
  const [kind, setKind] = useState("shipped");
  return (
    <form className="mb-form" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); run(async () => { const id = await createPost({ kind: kind as "shipped", title: String(d.get("title")), body: String(d.get("body")), link: String(d.get("link") || ""), city: String(d.get("city") || ""), happens_at: String(d.get("when") || "") }); router.push(`/members/board/${id}`); }); }}>
      <div className="mb-kinds" role="group" aria-label={t.kind}>{Object.entries(t.kinds).map(([k, v]) => <button key={k} type="button" className="pill-s" aria-pressed={kind === k} onClick={() => setKind(k)}>{v}</button>)}</div>
      <label className="fld"><span>{t.title}</span><input name="title" required maxLength={160} dir="auto" /></label>
      <label className="fld"><span>{t.body}</span><textarea name="body" rows={4} maxLength={6000} dir="auto" /></label>
      <label className="fld"><span>{t.link}</span><input name="link" type="url" dir="ltr" placeholder="https://" /></label>
      {kind === "meetup" ? <div className="mb-2col"><label className="fld"><span>{t.when}</span><input name="when" type="datetime-local" required /></label><label className="fld"><span>{t.city}</span><input name="city" required maxLength={80} dir="auto" /></label></div> : null}
      <button className="b" disabled={pending}>{t.post}</button>
      <Err msg={err} />
    </form>
  );
}
export function DeletePost({ t, id }: { t: T; id: string }) {
  const router = useRouter();
  const { run, pending } = useRun();
  return <button type="button" className="b ghost" disabled={pending} onClick={() => run(async () => { await deletePost(id); router.push("/members/board"); })}>{t.remove}</button>;
}
export function CommentForm({ t, postId }: { t: T; postId: string }) {
  const { run, pending, err } = useRun();
  return (
    <form className="mb-comment" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, v = String(new FormData(f).get("c") || "").trim(); if (v) run(() => addComment(postId, v), () => f.reset()); }}>
      <input name="c" className="inp" placeholder={t.commentPh} aria-label={t.comment} maxLength={2000} dir="auto" />
      <button className="b" disabled={pending}>{t.comment}</button><Err msg={err} />
    </form>
  );
}
export function Toggle({ table, postId, on, label, count }: { table: "member_reactions" | "member_rsvps"; postId: string; on: boolean; label: string; count: number }) {
  const { run, pending } = useRun();
  return <button type="button" className="pill-s" aria-pressed={on} disabled={pending} onClick={() => run(() => toggle(table, postId))}>{label} <span className="key">{count}</span></button>;
}

export function IntroForm({ t, to }: { t: T; to: string }) {
  const { run, pending, err } = useRun();
  const [sent, setSent] = useState(false);
  if (sent) return <p className="mb-ok" role="status">{t.introSent}</p>;
  return (
    <form className="mb-form" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("note") || ""); run(() => requestIntro(to, v), () => setSent(true)); }}>
      <label className="fld"><span>{t.introNote}</span><textarea name="note" required minLength={10} maxLength={1000} rows={3} dir="auto" /></label>
      <button className="b" disabled={pending}>{t.askIntro}</button><Err msg={err} />
    </form>
  );
}
export function IntroDecide({ t, id }: { t: T; id: string }) {
  const { run, pending, err } = useRun();
  return <div className="row-btns"><button type="button" className="b" disabled={pending} onClick={() => run(() => decideIntro(id, true))}>{t.accept}</button><button type="button" className="b ghost" disabled={pending} onClick={() => run(() => decideIntro(id, false))}>{t.decline}</button><Err msg={err} /></div>;
}
export function ShowEmail({ id }: { id: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return email ? <a href={`mailto:${email}`} dir="ltr">{email}</a> : <button type="button" className="pill-s" disabled={pending} onClick={() => start(async () => setEmail(await introContacts(id)))}>@</button>;
}

export function InviteMaker({ t, remaining }: { t: T; remaining: number }) {
  const { run, pending, err } = useRun();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-form">
      {url ? <div className="mb-invite"><code dir="ltr">{url}</code><button type="button" className="b" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? t.copied : t.copy}</button></div> : null}
      {remaining > 0 ? <form className="mb-trip" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("email") || ""); run(async () => { setUrl(await createInvite(v)); setCopied(false); }); }}>
        <label className="fld"><span>{t.forEmail}</span><input name="email" type="email" dir="ltr" /></label>
        <button className="b" disabled={pending}>{t.newInvite}</button>
      </form> : null}
      <Err msg={err} />
    </div>
  );
}
