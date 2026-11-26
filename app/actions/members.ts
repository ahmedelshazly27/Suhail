"use server";
import { createElement } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Templated } from "@/emails/Templated";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { INVITES_PER_MEMBER, inviteValid, LOOKING, memberLink, newInviteCode, POST_KINDS, requireMember, ROLES } from "@/lib/members";
import { rateLimit } from "@/lib/security";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// Members app actions. Anything a member does runs with their own session, so RLS decides what they can touch; the
// service role is used only for steps a signed-out person takes (sign-in links, joining, applying) and for
// introductions, where the server shares two addresses once both people have agreed.

type Res = { ok: boolean; msg?: string };
const mail = z.string().trim().toLowerCase().email().max(254);
const lang = async () => ((await cookies()).get("m-lang")?.value === "en" ? "en" : "ar") as "ar" | "en";

async function emailLink(to: string, l: "ar" | "en", tokenHash: string, invite?: string) {
  const url = memberLink(`/auth/confirm?token_hash=${tokenHash}${invite ? `&invite=${invite}` : ""}`);
  const ar = `رابط دخولك لأعضاء سهيل:\n\n${url}\n\nيشتغل مرة وحدة وينتهي خلال ساعة. إذا ما طلبته، تجاهل هالإيميل.`;
  const en = `Your sign-in link for Suhail Members:\n\n${url}\n\nIt works once and expires in an hour. If you didn't ask for it, ignore this email.`;
  return sendEmail({ to, subject: l === "ar" ? "رابط دخولك لسهيل" : "Sign in to Suhail Members", react: createElement(Templated, { lang: l, bodyAr: ar, bodyEn: en, vars: {} }), log: { template: "member-link" } });
}

/** Sign-in link for an existing member. Says the same thing whether or not the address is a member, after the check. */
export async function sendMemberLink(_: unknown, form: FormData): Promise<Res> {
  const email = mail.safeParse(form.get("email"));
  if (!email.success) return { ok: false, msg: "error" };
  if (!(await rateLimit("member-link", 6, 900))) return { ok: false, msg: "error" };
  const admin = supabaseAdmin();
  const { data: p } = await admin.from("member_private").select("id").eq("email", email.data).maybeSingle();
  if (!p) return { ok: false, msg: "notMember" };
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: email.data });
  if (error || !data.properties?.hashed_token) return { ok: false, msg: "error" };
  const r = await emailLink(email.data, await lang(), data.properties.hashed_token);
  return r.ok || r.error === "no_key" ? { ok: true, msg: "linkSent" } : { ok: false, msg: "error" };
}

/** Someone with an invite link: we email them a sign-in link that completes the invite when opened. */
export async function joinWithInvite(_: unknown, form: FormData): Promise<Res> {
  const v = z.object({ code: z.string(), name: z.string().trim().min(1).max(120), email: mail }).safeParse(Object.fromEntries(form));
  if (!v.success) return { ok: false, msg: "error" };
  if (!(await rateLimit("member-join", 6, 900))) return { ok: false, msg: "error" };
  if (!(await inviteValid(v.data.code, v.data.email))) return { ok: false, msg: "badInvite" };
  const admin = supabaseAdmin();
  await admin.auth.admin.createUser({ email: v.data.email, email_confirm: true, user_metadata: { name: v.data.name } }).catch(() => null);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: v.data.email });
  if (error || !data.properties?.hashed_token) return { ok: false, msg: "error" };
  if (!data.user.user_metadata?.name) await admin.auth.admin.updateUserById(data.user.id, { user_metadata: { ...data.user.user_metadata, name: v.data.name } });
  const r = await emailLink(v.data.email, await lang(), data.properties.hashed_token, v.data.code);
  return r.ok || r.error === "no_key" ? { ok: true, msg: "linkSent" } : { ok: false, msg: "error" };
}

/** Public application for people who don't know a member yet. */
export async function applyForMembership(_: unknown, form: FormData): Promise<Res> {
  const v = z.object({
    name: z.string().trim().min(1).max(120), email: mail, role: z.enum(ROLES), building: z.string().trim().min(10).max(1500),
    link: z.string().trim().url().max(500).or(z.literal("")).optional(), city: z.string().trim().max(80).optional(), website: z.string().max(0).optional(), // website = honeypot
  }).safeParse(Object.fromEntries(form));
  if (!v.success) return { ok: false, msg: "error" };
  if (!(await rateLimit("member-apply", 4, 3600))) return { ok: false, msg: "error" };
  const { error } = await supabaseAdmin().from("member_applications").insert({ name: v.data.name, email: v.data.email, role: v.data.role, building: v.data.building, link: v.data.link || null, city: v.data.city ?? "", lang: await lang() });
  return error ? { ok: false, msg: "error" } : { ok: true, msg: "applied" };
}

export async function setMemberLang(l: "ar" | "en") {
  if (l !== "ar" && l !== "en") return;
  (await cookies()).set("m-lang", l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const db = await supabaseServer();
  const { data: auth } = await db.auth.getClaims().catch(() => ({ data: null }));
  if (auth?.claims?.sub) await db.from("members").update({ lang: l }).eq("id", auth.claims.sub);
  revalidatePath("/members", "layout");
}

export async function memberSignOut() {
  await (await supabaseServer()).auth.signOut();
  redirect("/members/sign-in");
}

// ---------------------------------------------------------------- profile and trips

const links = z.object({ linkedin: z.string().trim().url().max(300).or(z.literal("")), x: z.string().trim().url().max(300).or(z.literal("")), github: z.string().trim().url().max(300).or(z.literal("")), site: z.string().trim().url().max(300).or(z.literal("")) }).partial();
const profile = z.object({
  name: z.string().trim().min(1).max(120), headline: z.string().trim().max(160), building: z.string().trim().max(1200), role: z.enum(ROLES),
  company: z.string().trim().max(120), city: z.string().trim().max(80), country: z.string().trim().max(80),
  skills: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20), looking_for: z.array(z.enum(LOOKING)).max(7), open_to_intros: z.boolean(), links,
});

export async function saveProfile(input: z.input<typeof profile>) {
  const me = await requireMember();
  const v = profile.parse(input);
  const clean = Object.fromEntries(Object.entries(v.links).filter(([, u]) => u));
  const { error } = await (await supabaseServer()).from("members").update({ ...v, links: clean, skills: [...new Set(v.skills)] }).eq("id", me.id);
  if (error) throw new Error(error.message);
  revalidatePath("/members", "layout");
}

const trip = z.object({ city: z.string().trim().min(1).max(80), country: z.string().trim().max(80).default(""), starts_on: z.string().date(), ends_on: z.string().date(), note: z.string().trim().max(200).default("") });
export async function addTrip(input: z.input<typeof trip>) {
  const me = await requireMember();
  const v = trip.parse(input);
  if (v.ends_on < v.starts_on) throw new Error("The trip ends before it starts.");
  const { error } = await (await supabaseServer()).from("member_trips").insert({ ...v, member_id: me.id });
  if (error) throw new Error(error.message);
  revalidatePath("/members", "layout");
}
export async function removeTrip(id: string) {
  await requireMember();
  await (await supabaseServer()).from("member_trips").delete().eq("id", z.string().uuid().parse(id));
  revalidatePath("/members", "layout");
}

// ---------------------------------------------------------------- board

const post = z.object({ kind: z.enum(POST_KINDS), title: z.string().trim().min(1).max(160), body: z.string().trim().max(6000).default(""), link: z.string().trim().url().max(500).or(z.literal("")).optional(), city: z.string().trim().max(80).default(""), happens_at: z.string().datetime({ local: true }).or(z.literal("")).optional() });
export async function createPost(input: z.input<typeof post>) {
  const me = await requireMember();
  const v = post.parse(input);
  if (v.kind === "meetup" && !v.happens_at) throw new Error("A meetup needs a date and time.");
  const { data, error } = await (await supabaseServer()).from("member_posts").insert({ member_id: me.id, kind: v.kind, title: v.title, body: v.body, link: v.link || null, city: v.city, happens_at: v.happens_at ? new Date(v.happens_at).toISOString() : null }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/members", "layout");
  return data.id as string;
}
export async function deletePost(id: string) {
  const me = await requireMember();
  await (await supabaseServer()).from("member_posts").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)).eq("member_id", me.id);
  revalidatePath("/members", "layout");
}
export async function addComment(postId: string, body: string) {
  const me = await requireMember();
  const b = z.string().trim().min(1).max(2000).parse(body);
  const { error } = await (await supabaseServer()).from("member_comments").insert({ post_id: z.string().uuid().parse(postId), member_id: me.id, body: b });
  if (error) throw new Error(error.message);
  revalidatePath(`/members/board/${postId}`);
}
/** Like and RSVP are toggles. */
export async function toggle(table: "member_reactions" | "member_rsvps", postId: string) {
  const me = await requireMember();
  if (table !== "member_reactions" && table !== "member_rsvps") return;
  const db = await supabaseServer(), pid = z.string().uuid().parse(postId);
  const { data } = await db.from(table).select("post_id").eq("post_id", pid).eq("member_id", me.id).maybeSingle();
  if (data) await db.from(table).delete().eq("post_id", pid).eq("member_id", me.id);
  else await db.from(table).insert({ post_id: pid, member_id: me.id });
  revalidatePath("/members", "layout");
}

// ---------------------------------------------------------------- introductions

async function introEmail(introId: string) {
  const admin = supabaseAdmin();
  const { data: i } = await admin.from("member_intros").select("from_id,to_id,note").eq("id", introId).single();
  if (!i) return;
  const [{ data: ms }, { data: ps }] = await Promise.all([
    admin.from("members").select("id,name,headline,lang").in("id", [i.from_id, i.to_id]),
    admin.from("member_private").select("id,email").in("id", [i.from_id, i.to_id]),
  ]);
  const get = (id: string) => ({ ...ms!.find((m) => m.id === id)!, email: ps!.find((p) => p.id === id)?.email as string });
  const a = get(i.from_id), b = get(i.to_id);
  for (const [me, other] of [[a, b], [b, a]] as const) {
    const ar = `${me.name}، تعارفتوا مع ${other.name}${other.headline ? ` (${other.headline})` : ""} عن طريق أعضاء سهيل.\n\nإيميله: ${other.email}\n\nرسالة الطلب:\n${i.note}\n\nردّوا على هالإيميل أو راسلوا بعض مباشرة.`;
    const en = `${me.name}, you're now connected with ${other.name}${other.headline ? ` (${other.headline})` : ""} through Suhail Members.\n\nTheir email: ${other.email}\n\nThe request said:\n${i.note}\n\nWrite to each other directly.`;
    await sendEmail({ to: me.email, subject: me.lang === "ar" ? `تعارف: ${other.name}` : `Introduction: ${other.name}`, react: createElement(Templated, { lang: me.lang === "en" ? "en" : "ar", bodyAr: ar, bodyEn: en, vars: {} }), log: { template: "member-intro", entity_type: "member_intro", entity_id: introId } });
  }
}

export async function requestIntro(toId: string, note: string) {
  const me = await requireMember();
  const v = z.object({ to: z.string().uuid(), note: z.string().trim().min(10).max(1000) }).parse({ to: toId, note });
  if (!(await rateLimit("member-intro", 10, 86400))) throw new Error("That's a lot of requests today. Try again tomorrow.");
  const db = await supabaseServer();
  const { data: other } = await db.from("members").select("id,name,lang,open_to_intros").eq("id", v.to).single();
  if (!other?.open_to_intros) throw new Error("Not taking introductions right now.");
  const { error } = await db.from("member_intros").insert({ from_id: me.id, to_id: v.to, note: v.note });
  if (error) throw new Error(error.code === "23505" ? "You already asked. They'll see it." : error.message);
  const { data: p } = await supabaseAdmin().from("member_private").select("email").eq("id", v.to).single();
  if (p) {
    const url = memberLink("/members/intros");
    const ar = `${me.name}${me.headline ? ` (${me.headline})` : ""} يبي يتعرف عليك في أعضاء سهيل:\n\n${v.note}\n\nوافق أو اعتذر من هنا: ${url}\n\nما نشارك إيميلك إلا إذا وافقت.`;
    const en = `${me.name}${me.headline ? ` (${me.headline})` : ""} would like an introduction on Suhail Members:\n\n${v.note}\n\nAccept or decline here: ${url}\n\nYour email is only shared if you accept.`;
    await sendEmail({ to: p.email, subject: other.lang === "en" ? `${me.name} would like to meet you` : `${me.name} يبي يتعرف عليك`, react: createElement(Templated, { lang: other.lang === "en" ? "en" : "ar", bodyAr: ar, bodyEn: en, vars: {} }), log: { template: "member-intro-request" } });
  }
  revalidatePath("/members/intros");
}

export async function decideIntro(id: string, accept: boolean) {
  const me = await requireMember();
  const db = await supabaseServer();
  const { data, error } = await db.from("member_intros").update({ status: accept ? "accepted" : "declined", decided_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)).eq("to_id", me.id).eq("status", "pending").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (data && accept) await introEmail(data.id);
  revalidatePath("/members/intros");
}

/** The two addresses of an accepted introduction, for the two people in it. */
export async function introContacts(id: string) {
  const me = await requireMember();
  const { data: i } = await (await supabaseServer()).from("member_intros").select("from_id,to_id,status").eq("id", z.string().uuid().parse(id)).single();
  if (!i || i.status !== "accepted" || (i.from_id !== me.id && i.to_id !== me.id)) return null;
  const other = i.from_id === me.id ? i.to_id : i.from_id;
  const { data } = await supabaseAdmin().from("member_private").select("email").eq("id", other).single();
  return data?.email ?? null;
}

// ---------------------------------------------------------------- invites

export async function createInvite(email: string) {
  const me = await requireMember();
  const e = email.trim() ? mail.parse(email) : null;
  const admin = supabaseAdmin();
  const { count } = await admin.from("member_invites").select("code", { count: "exact", head: true }).eq("created_by_member", me.id);
  if ((count ?? 0) >= INVITES_PER_MEMBER) throw new Error("You've used all your invites.");
  const code = newInviteCode();
  const { error } = await admin.from("member_invites").insert({ code, email: e, created_by_member: me.id });
  if (error) throw new Error(error.message);
  revalidatePath("/members/invite");
  return memberLink(`/members/join/${code}`);
}

// ---------------------------------------------------------------- team side

/** Accept an application by sending an invite to that address, or decline it. */
export async function reviewApplication(id: string, decision: "invite" | "decline") {
  const me = await requireAdmin();
  const db = await supabaseServer();
  const { data: a } = await db.from("member_applications").select("id,name,email,lang,status").eq("id", z.string().uuid().parse(id)).single();
  if (!a || a.status !== "new") throw new Error("Already reviewed.");
  if (decision === "invite") await teamInvite(a.email, a.name, a.lang === "en" ? "en" : "ar");
  await db.from("member_applications").update({ status: decision === "invite" ? "invited" : "declined", reviewed_by: me.id, reviewed_at: new Date().toISOString() }).eq("id", a.id);
  revalidatePath("/team/members");
}

/** The team invites someone directly: a one-time link emailed to them. */
export async function teamInvite(email: string, name = "", l: "ar" | "en" = "ar") {
  const me = await requireAdmin();
  const e = mail.parse(email);
  const code = newInviteCode();
  const { error } = await (await supabaseServer()).from("member_invites").insert({ code, email: e, created_by_team: me.id, note: name.slice(0, 300) });
  if (error) throw new Error(error.message);
  const url = memberLink(`/members/join/${code}`);
  const ar = `${name ? `${name}، ` : ""}أهلًا.\n\nأعضاء سهيل مساحة بالدعوة فقط للي يبنون ويموّلون ويوظّفون في العالم العربي. هذي دعوتك:\n\n${url}\n\nالرابط لك وحدك ويشتغل لمدة ٣٠ يوم.`;
  const en = `${name ? `Hi ${name},` : "Hi,"}\n\nSuhail Members is an invite-only space for the people who build, fund and hire across the Arab world. Here's your invite:\n\n${url}\n\nThe link is yours alone and works for 30 days.`;
  await sendEmail({ to: e, subject: l === "ar" ? "دعوتك لأعضاء سهيل" : "Your invite to Suhail Members", react: createElement(Templated, { lang: l, bodyAr: ar, bodyEn: en, vars: {} }), log: { template: "member-invite", created_by: me.id } });
  revalidatePath("/team/members");
  return url;
}

export async function setMemberStatus(id: string, status: "active" | "paused" | "removed") {
  await requireAdmin();
  const { error } = await (await supabaseServer()).from("members").update({ status: z.enum(["active", "paused", "removed"]).parse(status) }).eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  revalidatePath("/team/members");
}

// ---------------------------------------------------------------- photo

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
/** Upload a profile photo (JPEG, PNG or WebP, up to 3 MB) to the private bucket; the old one is removed. */
export async function uploadPhoto(form: FormData) {
  const me = await requireMember();
  const f = form.get("photo");
  if (!(f instanceof File) || !PHOTO_TYPES[f.type]) throw new Error("Use a JPEG, PNG or WebP photo.");
  if (f.size > 3 * 1024 * 1024) throw new Error("The photo must be under 3 MB.");
  const admin = supabaseAdmin();
  const path = `${me.id}/${newInviteCode()}.${PHOTO_TYPES[f.type]}`;
  const { error } = await admin.storage.from("member-photos").upload(path, f, { contentType: f.type });
  if (error) throw new Error(error.message);
  if (me.photo_path) await admin.storage.from("member-photos").remove([me.photo_path]);
  await admin.from("members").update({ photo_path: path }).eq("id", me.id);
  revalidatePath("/members", "layout");
}
export async function removePhoto() {
  const me = await requireMember();
  if (me.photo_path) await supabaseAdmin().storage.from("member-photos").remove([me.photo_path]);
  await supabaseAdmin().from("members").update({ photo_path: null }).eq("id", me.id);
  revalidatePath("/members", "layout");
}

// ---------------------------------------------------------------- shipped this week, Ask Suhail

/** The weekly ritual on Home: one line about what you shipped, posted to the board. */
export async function shipThisWeek(title: string, link: string) {
  return createPost({ kind: "shipped", title, link, body: "" });
}

const ask = z.object({ kind: z.enum(["intro", "help", "feedback"]), target: z.string().trim().max(200).default(""), body: z.string().trim().min(10).max(2000) });
/** A member asks the Suhail team for something: an introduction to a partner or investor, help, or feedback. */
export async function askSuhail(input: z.input<typeof ask>) {
  const me = await requireMember();
  const v = ask.parse(input);
  if (!(await rateLimit("member-ask", 10, 86400))) throw new Error("That's a lot of requests today. Try again tomorrow.");
  const { error } = await (await supabaseServer()).from("member_requests").insert({ member_id: me.id, ...v });
  if (error) throw new Error(error.message);
  revalidatePath("/members/ask");
}

/** The team answers a request; the member gets the answer in the app and by email. */
export async function answerRequest(id: string, answer: string, close = false) {
  const me = await requireAdmin();
  const a = z.string().trim().max(4000).parse(answer);
  const db = await supabaseServer();
  const { data: r, error } = await db.from("member_requests").update({ answer: a, status: close && !a ? "closed" : "answered", answered_by: me.id, answered_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)).select("member_id,body").single();
  if (error) throw new Error(error.message);
  if (a) {
    const admin = supabaseAdmin();
    const [{ data: m }, { data: p }] = await Promise.all([admin.from("members").select("name,lang").eq("id", r.member_id).single(), admin.from("member_private").select("email").eq("id", r.member_id).single()]);
    if (m && p) {
      const url = memberLink("/members/ask");
      const ar = `${m.name}، رد فريق سهيل على طلبك:\n\n${a}\n\nطلبك كان:\n${r.body}\n\n${url}`;
      const en = `${m.name}, the Suhail team answered your request:\n\n${a}\n\nYou asked:\n${r.body}\n\n${url}`;
      await sendEmail({ to: p.email, subject: m.lang === "en" ? "Suhail answered your request" : "سهيل رد على طلبك", react: createElement(Templated, { lang: m.lang === "en" ? "en" : "ar", bodyAr: ar, bodyEn: en, vars: {} }), log: { template: "member-request-answer", created_by: me.id } });
    }
  }
  revalidatePath("/team/members");
}

// ---------------------------------------------------------------- opportunities (team)

const opp = z.object({
  kind: z.enum(["perk", "grant", "job", "event", "call"]), title: z.string().trim().min(1).max(160), org: z.string().trim().max(120).default(""),
  body: z.string().trim().max(3000).default(""), url: z.string().trim().url().max(600).or(z.literal("")).optional(), deadline: z.string().date().or(z.literal("")).optional(),
  location: z.string().trim().max(120).default(""), tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]),
});
export async function saveOpportunity(id: string | null, input: z.input<typeof opp>) {
  await requireAdmin();
  const v = opp.parse(input);
  const row = { ...v, url: v.url || null, deadline: v.deadline || null };
  const db = await supabaseServer();
  const { error } = id ? await db.from("member_opportunities").update(row).eq("id", z.string().uuid().parse(id)) : await db.from("member_opportunities").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/team/members"); revalidatePath("/members", "layout");
}
export async function setOpportunityPublished(id: string, published: boolean) {
  await requireAdmin();
  await (await supabaseServer()).from("member_opportunities").update({ published }).eq("id", z.string().uuid().parse(id));
  revalidatePath("/team/members"); revalidatePath("/members", "layout");
}
/** Adds the starter list of credits, grants and programs (content/members/opportunities.json); skips ones already there. */
export async function importOpportunities() {
  await requireAdmin();
  const { default: list } = await import("@/content/members/opportunities.json");
  const db = await supabaseServer();
  const { data: have } = await db.from("member_opportunities").select("title");
  const seen = new Set((have || []).map((h) => h.title.toLowerCase()));
  const rows = (list as z.input<typeof opp>[]).map((o) => opp.parse(o)).filter((o) => !seen.has(o.title.toLowerCase())).map((o) => ({ ...o, url: o.url || null, deadline: o.deadline || null, source: "pack:2026-11" }));
  if (rows.length) { const { error } = await db.from("member_opportunities").insert(rows); if (error) throw new Error(error.message); }
  revalidatePath("/team/members"); revalidatePath("/members", "layout");
  return rows.length;
}
