import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/team/sign-in", req.url), 303);
}
