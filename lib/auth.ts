import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { seal } from "@/lib/crypto";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type Me = {
  id: string; email: string; name: string; job_title: string; avatar_url: string | null; team_role: "owner" | "admin" | "member";
  functions: string[]; lang: "ar" | "en"; ics_token: string; onboarded_at: string | null; active: boolean; digest_email: boolean; standup_enabled: boolean;
};

/** The signed-in teammate, or null. Cached per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return null;
  const { data } = await supabaseAdmin().from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Me | null) ?? null;
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me || !me.active) redirect("/team/sign-in");
  return me;
}

export async function requireAdmin(): Promise<Me> {
  const me = await requireMe();
  if (me.team_role !== "owner" && me.team_role !== "admin") redirect("/team?e=forbidden");
  return me;
}

export const isAdmin = (me: Me) => me.team_role === "owner" || me.team_role === "admin";

const GROUP_ROLE: Record<string, Me["team_role"]> = { "suhail-owners": "owner", "suhail-admins": "admin", "suhail-team": "member" };
const RANK = { owner: 3, admin: 2, member: 1 } as const;

type Graph = { me: { displayName?: string; jobTitle?: string; mail?: string; userPrincipalName?: string; id: string }; groups: string[]; photo?: Buffer };

async function readGraph(token: string): Promise<Graph | null> {
  const g = (p: string) => fetch(`https://graph.microsoft.com/v1.0${p}`, { headers: { authorization: `Bearer ${token}` } });
  const meRes = await g("/me?$select=id,displayName,jobTitle,mail,userPrincipalName");
  if (!meRes.ok) return null;
  const me = await meRes.json();
  const groups: string[] = [];
  let next: string | null = "/me/memberOf/microsoft.graph.group?$select=displayName&$top=100";
  while (next) {
    const r = await g(next);
    if (!r.ok) break;
    const j = (await r.json()) as { value: { displayName: string }[]; "@odata.nextLink"?: string };
    groups.push(...j.value.map((x) => x.displayName));
    next = j["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
  }
  const ph = await g("/me/photos/96x96/$value");
  return { me, groups, photo: ph.ok ? Buffer.from(await ph.arrayBuffer()) : undefined };
}

/**
 * Runs on every sign-in. Microsoft: role from Entra group membership (no group, no access). Owner magic link
 * (DEV_LOGIN): only OWNER_EMAIL, as owner. Returns where to send the person next.
 */
export async function provision(user: User, providerToken?: string | null, providerRefresh?: string | null): Promise<string> {
  const db = supabaseAdmin();
  const email = (user.email || "").toLowerCase();
  const { data: existing } = await db.from("profiles").select("id,onboarded_at").eq("id", user.id).maybeSingle();
  let role: Me["team_role"] | null = null;
  const patch: Record<string, unknown> = { email };

  if (user.app_metadata?.provider === "azure" && providerToken) {
    const g = await readGraph(providerToken);
    if (!g) return "/team/sign-in?e=graph";
    role = g.groups.map((n) => GROUP_ROLE[n]).filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
    Object.assign(patch, { name: g.me.displayName || email, job_title: g.me.jobTitle || "", ms_oid: g.me.id, ms_groups: g.groups });
    if (g.photo) {
      const path = `${user.id}/photo.jpg`;
      const up = await db.storage.from("avatars").upload(path, g.photo, { contentType: "image/jpeg", upsert: true });
      if (!up.error) patch.avatar_url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
    }
    if (providerRefresh && role) {
      await db.from("graph_tokens").upsert({ profile_id: user.id, refresh_token_enc: seal(providerRefresh), scope: "delegated" });
    }
  } else if (env.devLogin() && email === env.ownerEmail()) {
    role = "owner";
    if (!existing) Object.assign(patch, { name: user.user_metadata?.name || "Ahmed", job_title: "Founder" });
  }

  if (!role) {
    if (existing) await db.from("profiles").update({ active: false }).eq("id", user.id);
    return "/team/sign-in?e=noaccess";
  }
  Object.assign(patch, { team_role: role, active: true });
  if (existing) await db.from("profiles").update(patch).eq("id", user.id);
  else await db.from("profiles").insert({ id: user.id, ...patch });
  return existing?.onboarded_at ? "/team" : "/team/welcome";
}
