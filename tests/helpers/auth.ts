import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// Signs the owner in the way the DEV_LOGIN email link does: a one-time token verified by /auth/confirm.
export async function signInOwner(page: Page, email = process.env.OWNER_EMAIL || "admin@afterwave.org") {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  // Parallel workers share one user, and a new link invalidates the previous one, so retry when ours lost the race.
  for (let i = 0; i < 4; i++) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}`);
    if (!page.url().includes("/sign-in")) return;
    await page.waitForTimeout(300 + Math.random() * 700);
  }
}
