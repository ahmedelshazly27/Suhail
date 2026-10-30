import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Supabase as the signed-in teammate. Every query goes through RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnon(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service role. Only for public form writes after validation, webhooks, cron jobs and signed URLs. Never send to the client. */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.serviceRole(), { auth: { persistSession: false, autoRefreshToken: false } });
}
