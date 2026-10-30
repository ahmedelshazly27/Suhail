"use server";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function finishOnboarding() {
  const me = await requireMe();
  const db = await supabaseServer();
  await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", me.id);
  redirect("/team");
}
