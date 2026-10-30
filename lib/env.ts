// Server-side environment, read lazily so a missing optional integration never breaks the build.
const v = (k: string) => process.env[k] || "";

export const env = {
  supabaseUrl: () => v("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnon: () => v("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRole: () => v("SUPABASE_SERVICE_ROLE_KEY"),
  siteUrl: () => (v("NEXT_PUBLIC_SITE_URL") || (v("VERCEL_URL") ? `https://${v("VERCEL_URL")}` : "http://localhost:3000")).replace(/\/$/, ""),
  // Dashboard origin: https://<TEAM_HOST> when the team host is set (sign-in cookies must land on it), else the site URL.
  teamUrl: () => (v("TEAM_HOST") ? `https://${v("TEAM_HOST")}` : (v("NEXT_PUBLIC_SITE_URL") || (v("VERCEL_URL") ? `https://${v("VERCEL_URL")}` : "http://localhost:3000")).replace(/\/$/, "")),
  resendKey: () => v("RESEND_API_KEY"),
  mailFrom: () => v("MAIL_FROM") || "Suhail <hello@suhail.build>",
  // Outside Production, every email is redirected here (see lib/email/send.ts).
  mailSafeTo: () => v("MAIL_SAFE_TO") || "a.elshazly@suhail.build",
  isProduction: () => v("VERCEL_ENV") === "production",
  turnstileSite: () => v("NEXT_PUBLIC_TURNSTILE_SITE_KEY") || "1x00000000000000000000AA", // Cloudflare's published always-pass test key
  turnstileSecret: () => v("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA",
  devLogin: () => v("DEV_LOGIN") === "1" && v("VERCEL_ENV") !== "production",
  ownerEmail: () => (v("OWNER_EMAIL") || "a.elshazly@suhail.build").toLowerCase(),
  azure: () => ({ tenant: v("AZURE_TENANT_ID"), clientId: v("AZURE_CLIENT_ID"), secret: v("AZURE_CLIENT_SECRET") }),
  azureGroups: () => ({ owners: v("AZURE_GROUP_OWNERS"), admins: v("AZURE_GROUP_ADMINS"), team: v("AZURE_GROUP_TEAM") }),
  azureReady: () => Boolean(v("AZURE_TENANT_ID") && v("AZURE_CLIENT_ID") && v("AZURE_CLIENT_SECRET")),
  teamsWebhook: () => v("TEAMS_WEBHOOK_URL"),
  bot: () => ({ id: v("MICROSOFT_BOT_ID"), password: v("MICROSOFT_BOT_PASSWORD") }),
  tasksMailbox: () => v("TASKS_MAILBOX"),
  cronSecret: () => v("CRON_SECRET"),
  tokenKey: () => v("TOKEN_ENCRYPTION_KEY"),
  anthropicKey: () => v("ANTHROPIC_API_KEY"),
  resendAudience: (lang: "ar" | "en") => v(lang === "ar" ? "RESEND_AUDIENCE_ID_AR" : "RESEND_AUDIENCE_ID_EN"),
  resendWebhookSecret: () => v("RESEND_WEBHOOK_SECRET"),
  teamHost: () => v("TEAM_HOST"), // e.g. team.suhail.build
};
