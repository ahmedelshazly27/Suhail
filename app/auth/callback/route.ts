import { NextResponse } from "next/server";
import { provision } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

// OAuth return from Microsoft (via Supabase Auth).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/team/sign-in?e=nocode", url));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(new URL("/team/sign-in?e=exchange", url));
  const next = await provision(data.session.user, data.session.provider_token, data.session.provider_refresh_token);
  if (next.includes("e=")) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(next, url));
}
