"use server";
import { createElement } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security";
import { sendEmail } from "@/lib/email/send";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { Templated } from "@/emails/Templated";

// Scopes requested at sign-in. Each is explained in docs/microsoft.md.
const SCOPES = "openid email profile offline_access User.Read GroupMember.Read.All User.ReadBasic.All Mail.ReadWrite Mail.Send Mail.Read.Shared Mail.Send.Shared Files.ReadWrite.All Sites.ReadWrite.All Calendars.ReadBasic Tasks.ReadWrite";

export async function signInWithMicrosoft() {
  if (!env.azureReady()) redirect("/team/sign-in?e=azure");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: SCOPES, redirectTo: `${env.teamUrl()}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/team/sign-in?e=oauth");
  redirect(data.url);
}

/** DEV_LOGIN only: a one-time sign-in link for the owner, sent through our own mailer. */
export async function sendOwnerLink(_: unknown, form: FormData): Promise<{ ok: boolean; msg: "linkSent" | "notAllowed" | "error" }> {
  if (!env.devLogin()) return { ok: false, msg: "notAllowed" };
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success || email.data !== env.ownerEmail()) return { ok: false, msg: "notAllowed" };
  if (!(await rateLimit("owner-link", 5, 900))) return { ok: false, msg: "error" };
  const admin = supabaseAdmin().auth.admin;
  await admin.createUser({ email: email.data, email_confirm: true }).catch(() => null); // already exists is fine
  const { data, error } = await admin.generateLink({ type: "magiclink", email: email.data });
  if (error || !data.properties?.hashed_token) return { ok: false, msg: "error" };
  const url = `${env.teamUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}`;
  const body = `Your sign-in link for the Suhail dashboard:\n\n${url}\n\nIt works once and expires in an hour.`;
  const r = await sendEmail({ to: email.data, subject: "Sign in to Suhail", react: createElement(Templated, { lang: "en", bodyAr: body, bodyEn: body, vars: {} }) });
  return r.ok || r.error === "no_key" ? { ok: true, msg: "linkSent" } : { ok: false, msg: "error" };
}

export async function setTeamPref(name: "team-lang" | "team-theme", value: string) {
  if (!["ar", "en", "light", "dark", "system"].includes(value)) return;
  (await cookies()).set(name, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
