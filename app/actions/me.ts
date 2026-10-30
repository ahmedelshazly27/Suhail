"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function finishOnboarding() {
  const me = await requireMe();
  const db = await supabaseServer();
  await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", me.id);
  redirect("/team");
}

/** The first-sign-in tour was finished or skipped. */
export async function finishTour() {
  const me = await requireMe();
  await supabaseAdmin().from("profiles").update({ toured_at: new Date().toISOString() }).eq("id", me.id);
}

/** Settings, "Replay the tour": it shows again on Home. */
export async function replayTour() {
  const me = await requireMe();
  await supabaseAdmin().from("profiles").update({ toured_at: null }).eq("id", me.id);
  revalidatePath("/team", "layout"); // the tour lives in the shared dashboard layout
  redirect("/team");
}
