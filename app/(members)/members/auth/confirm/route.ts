import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { inviteValid } from "@/lib/members";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// A member's sign-in link. With an invite code it also creates the membership, once, for the address the link was
// sent to (the link itself proves the address).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash") || "";
  const invite = url.searchParams.get("invite") || "";
  const to = (p: string) => NextResponse.redirect(new URL(p, url));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
  if (error || !data.user?.email) return to("/members/sign-in?e=link");
  const admin = supabaseAdmin(), user = data.user, email = user.email!.toLowerCase();
  const { data: existing } = await admin.from("members").select("id,status").eq("id", user.id).maybeSingle();
  if (existing) return to(existing.status === "active" ? "/members" : "/members/sign-in?e=paused");
  const inv = invite ? await inviteValid(invite, email) : null;
  if (!inv) { await supabase.auth.signOut(); return to(invite ? `/members/join/${invite}?e=used` : "/members/sign-in?e=notMember"); }
  // Claim the invite first, so two tabs can't both use it.
  const { data: claimed } = await admin.from("member_invites").update({ used_at: new Date().toISOString() }).eq("code", inv.code).is("used_at", null).select("code").maybeSingle();
  if (!claimed) { await supabase.auth.signOut(); return to(`/members/join/${invite}?e=used`); }
  const name = String(user.user_metadata?.name || email.split("@")[0]).slice(0, 120);
  const lang = (await cookies()).get("m-lang")?.value === "en" ? "en" : "ar";
  const { error: e1 } = await admin.from("members").insert({ id: user.id, name, invited_by: inv.created_by_member, lang });
  if (e1) return to("/members/sign-in?e=link");
  await admin.from("member_private").insert({ id: user.id, email });
  await admin.from("member_invites").update({ used_by: user.id }).eq("code", inv.code);
  return to("/members/me?welcome=1");
}
