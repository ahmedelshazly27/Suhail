import { NextResponse } from "next/server";
import { provision } from "@/lib/auth";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

// Owner magic link (DEV_LOGIN only). The link carries a hashed token we verify server-side.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!env.devLogin()) return NextResponse.redirect(new URL("/team/sign-in", url));
  const token_hash = url.searchParams.get("token_hash") || "";
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
  if (error || !data.user) return NextResponse.redirect(new URL("/team/sign-in?e=link", url));
  const next = await provision(data.user);
  if (next.includes("e=")) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(next, url));
}
