import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Page } from "@playwright/test";

// Signs the owner in the way the DEV_LOGIN email link does: a one-time token verified by /auth/confirm.
export async function signInOwner(page: Page, email = process.env.OWNER_EMAIL || "a.elshazly@suhail.build") {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  // Parallel workers share one user, and a new link invalidates the previous one, so retry when ours lost the race.
  for (let i = 0; i < 4; i++) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}`);
    if (!page.url().includes("/sign-in")) {
      // The first-sign-in tour has its own test (tour.spec.ts); everywhere else it would cover the page.
      await admin.from("profiles").update({ toured_at: new Date().toISOString() }).eq("email", email);
      return;
    }
    await page.waitForTimeout(300 + Math.random() * 700);
  }
}

/**
 * A fresh teammate who has seen the welcome screen but not the tour, signed in by putting a real Supabase session in
 * the browser's cookies (DEV_LOGIN only lets the owner in, and the owner is shared by parallel workers).
 */
export async function signInNewTeammate(page: Page, lang: "en" | "ar") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `tour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@suhail.build`, password = `T-${Math.random().toString(36)}x9!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ id: data.user.id, email, name: "Tour Tester", team_role: "member", active: true, lang, onboarded_at: new Date().toISOString(), toured_at: null });
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => jar, setAll: (list) => list.forEach((c) => jar.push({ name: c.name, value: c.value })) } });
  const signed = await ssr.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  await page.context().addCookies(jar.map((c) => ({ ...c, url: "http://localhost:3000" })));
  return { id: data.user.id, admin };
}
