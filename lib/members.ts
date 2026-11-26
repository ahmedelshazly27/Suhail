import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// Suhail Members: the invite-only app. Members sign in with an email link and have a row in public.members; they
// never get a team profile. Everything they read goes through RLS with their own session.

export const ROLES = ["Engineer", "Founder", "Researcher", "Designer", "Product", "Investor", "Operator", "Student"] as const;
export const LOOKING = ["cofounder", "hiring", "job", "funding", "collaborators", "mentor", "mentee"] as const;
export const POST_KINDS = ["shipped", "ask", "discussion", "meetup"] as const;
export const INVITES_PER_MEMBER = 3;

export type Member = {
  id: string; name: string; headline: string; building: string; role: string; company: string; city: string; country: string;
  skills: string[]; looking_for: string[]; open_to_intros: boolean; links: Record<string, string>; avatar_url: string | null; photo_path: string | null;
  lang: "ar" | "en"; status: string; joined_at: string;
};
export const MEMBER_COLS = "id,name,headline,building,role,company,city,country,skills,looking_for,open_to_intros,links,avatar_url,photo_path,lang,status,joined_at";

export const membersUrl = () => (process.env.MEMBERS_HOST ? `https://${process.env.MEMBERS_HOST}` : `${env.siteUrl()}/members`);
/** A path inside the app, as a full URL for emails. */
export const memberLink = (path = "") => `${membersUrl()}${path.replace(/^\/members/, "")}`;

/** The signed-in member (any status), or null. Cached per request. */
export const getMember = cache(async (): Promise<Member | null> => {
  const db = await supabaseServer();
  const { data: auth } = await db.auth.getClaims().catch(() => ({ data: null }));
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const { data } = await db.from("members").select(MEMBER_COLS).eq("id", uid).maybeSingle();
  return (data as Member | null) ?? null;
});

export async function requireMember(): Promise<Member> {
  const m = await getMember();
  if (!m) redirect("/members/sign-in");
  if (m.status !== "active") redirect("/members/sign-in?e=paused");
  return m;
}

/** Interface language: the member's choice, else the cookie, else Arabic. */
export async function memberLang(m?: Member | null): Promise<"ar" | "en"> {
  if (m) return m.lang;
  const c = (await cookies()).get("m-lang")?.value;
  return c === "en" ? "en" : "ar";
}

export const newInviteCode = () => randomBytes(8).toString("hex").slice(0, 10);

const tokens = (m: Member) => new Set([...m.skills.map((s) => s.toLowerCase()), m.role.toLowerCase(), m.city.toLowerCase(), m.country.toLowerCase()].filter(Boolean));
// What one member is looking for and who would answer it.
const ANSWERS: Record<string, string[]> = { cofounder: ["cofounder"], hiring: ["job"], job: ["hiring"], funding: [], collaborators: ["collaborators"], mentor: ["mentee"], mentee: ["mentor"] };

/**
 * Today's picks: a handful of members worth meeting, chosen for what they're looking for and what they share, and
 * rotated by day so the list changes. Deterministic, so a reload shows the same people.
 */
export function picks(me: Member, all: Member[], day: string, n = 6) {
  const mine = tokens(me);
  const seed = (id: string) => { let h = 0; for (const c of id + day) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h / 4294967296; };
  return all.filter((m) => m.id !== me.id).map((m) => {
    let score = 0;
    for (const t of tokens(m)) if (mine.has(t)) score += 1;
    for (const want of me.looking_for) if ((ANSWERS[want] || []).some((w) => m.looking_for.includes(w))) score += 3;
    if (me.looking_for.includes("funding") && m.role === "Investor") score += 3;
    if (me.looking_for.includes("hiring") && ["Engineer", "Researcher", "Designer", "Product"].includes(m.role)) score += 1;
    return { m, score: score + seed(m.id) * 2 };
  }).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.m);
}

/** Search the directory: every word must match somewhere in the profile ("ml riyadh cofounder"). */
export function search(all: Member[], q: string) {
  const words = q.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1);
  if (!words.length) return all;
  return all.filter((m) => {
    const hay = [m.name, m.headline, m.building, m.role, m.company, m.city, m.country, ...m.skills, ...m.looking_for].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, "")));
  });
}

/** Checks an invite code: unused, not expired, and for this address if it names one. */
export async function inviteValid(code: string, email?: string) {
  if (!/^[a-z0-9]{8,16}$/.test(code)) return null;
  const { data } = await supabaseAdmin().from("member_invites").select("code,email,created_by_member,used_by,expires_at").eq("code", code).maybeSingle();
  if (!data || data.used_by || new Date(data.expires_at) < new Date()) return null;
  if (email && data.email && data.email.toLowerCase() !== email.toLowerCase()) return null;
  return data;
}


/** Dates the home page filters on: today, 30 days out, and a week ago. */
export function homeDates() {
  const now = Date.now();
  return { today: new Date(now).toISOString().slice(0, 10), soon: new Date(now + 30 * 864e5).toISOString().slice(0, 10), week: new Date(now - 7 * 864e5).toISOString() };
}

/**
 * Photo URLs for a set of members: their uploaded photo (a signed URL, valid for an hour), else their GitHub picture
 * when they linked a GitHub profile, else nothing (the card shows initials).
 */
export async function photos(ms: Pick<Member, "id" | "photo_path" | "links">[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const paths = [...new Set(ms.map((m) => m.photo_path).filter(Boolean))] as string[];
  if (paths.length) {
    const { data } = await supabaseAdmin().storage.from("member-photos").createSignedUrls(paths, 3600);
    const byPath = new Map((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    for (const m of ms) if (m.photo_path && byPath.has(m.photo_path)) out[m.id] = byPath.get(m.photo_path)!;
  }
  for (const m of ms) {
    const gh = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/?$/.exec(m.links?.github || "");
    if (!out[m.id] && gh) out[m.id] = `https://github.com/${gh[1]}.png?size=400`;
  }
  return out;
}

export type Opportunity = { id: string; kind: string; title: string; org: string; body: string; url: string | null; deadline: string | null; location: string; tags: string[]; created_at: string };
export const OPP_COLS = "id,kind,title,org,body,url,deadline,location,tags,created_at";

/** Opportunities ranked for one member: what matches their skills and needs first, then the nearest deadline. */
export function forMember(me: Member, list: Opportunity[]) {
  const mine = new Set([...me.skills, ...me.looking_for, me.role, me.city, me.country].map((s) => s.toLowerCase()).filter(Boolean));
  const wantsJob = me.looking_for.includes("job"), student = me.role === "Student";
  const score = (o: Opportunity) => o.tags.filter((t) => mine.has(t.toLowerCase())).length * 2 + (o.kind === "job" && wantsJob ? 3 : 0) + (student && o.tags.includes("students") ? 3 : 0) + (o.deadline ? 1 : 0);
  return [...list].sort((a, b) => score(b) - score(a) || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
}

/** Weeks in a row (ending this week or last) in which a member posted something they shipped. */
export function streak(dates: string[], now = Date.now()) {
  const week = (t: number) => Math.floor((t / 864e5 + 3) / 7); // weeks starting Monday
  const weeks = new Set(dates.map((d) => week(Date.parse(d))));
  let w = week(now), n = 0;
  if (!weeks.has(w)) w -= 1;
  while (weeks.has(w)) { n++; w--; }
  return n;
}
