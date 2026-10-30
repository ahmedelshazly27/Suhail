You are building Suhail: the public website plus the internal team dashboard. Work autonomously from start to finish. Don't stop to ask me things you can decide yourself.

## Setup
- **Repo:** `ahmedelshazly27/suhail` on GitHub (empty, connected). Work in it and push to it.
- **Spec:** the attached `suhail-build.zip` contains everything. Unzip it into the repo root first and commit it as the first commit:
  - `PROMPT.md`: the full spec. It's your source of truth; read it end to end before writing code.
  - `design-system/`: tokens, components, voice rules.
  - `reference/suhail.html`: the website prototype to port exactly.
  - `reference/dashboard-mockup/`: the approved desktop screens, one `.dc.html` per screen.
  - `reference/mobile-prototype.html`: the approved phone layout.
- **Secrets.** Supabase, Resend and Vercel credentials are in this environment's network secrets with full access to my accounts. My sending domain is already set up and verified in Resend. List the environment variable names (never print values) and use them. Never commit secrets: use `.env.local` (gitignored) and Vercel environment variables.

## How to work
1. **Plan.** Read everything, then write `PLAN.md`: schema, routes, phases and acceptance checks, following `PROMPT.md` section 7. Commit it.
2. **Infrastructure.** Create the Supabase projects (staging and production) using the access token. Run migrations with RLS, create the storage buckets, and seed the five roles from the prototype. Resend: use the domain already verified in my account (check it through the API) for all sending. Vercel: create the project linked to the GitHub repo, set every environment variable for Preview and Production, and deploy previews on each PR and production on `main`.
3. **Build phase by phase,** in the order of `PROMPT.md` section 7. After each phase:
   - typecheck, lint, and run Playwright tests (desktop 1440 and phone 390, light and dark, Arabic and English)
   - screenshot every screen you touched and compare it against the matching mockup in `reference/`
   - fix differences until it matches
   - commit with a clear message and push

   Use short-lived branches merged to `main` once checks pass. Keep CI (GitHub Actions) green.
4. **Keep a running log** in `PROGRESS.md`: what's done, what's next, decisions you made and why.
5. **Never stall.** If something needs me (see below), build that part behind a feature flag with a working fallback, add it to `BLOCKERS.md` with exact steps for me, and keep going on everything else.
6. **Perfect it.** When all phases are done, do a full pass against the definition of done in `PROMPT.md` section 8:
   - accessibility (axe), Lighthouse 95+ on the public site
   - RTL check of every screen
   - a security review of every RLS policy and server action
   - the design-system CI checks (no raw hex, no left/right properties, no em dashes)

   Fix everything you find, then go through it once more.

## Fallbacks while things are pending
- **Microsoft sign-in (Entra ID).** As soon as the Supabase production project exists, put the exact Microsoft redirect URL at the top of `BLOCKERS.md` so I can register the app. Until the `AZURE_*` secrets appear in this environment, add an owner-only email magic-link sign-in through Supabase for admin@afterwave.org, behind a flag called `DEV_LOGIN` that's off in production. Build all the Microsoft Graph features against typed interfaces with mock adapters, so they switch on as soon as the credentials are added.
- **Turnstile.** Use Cloudflare's published test keys until real ones are added.
- **Teams.** Implement the Teams webhook and bot; they stay off until their URLs and IDs are set.

## Rules
- Ask me before anything that costs money (paid plans, upgrades, buying a domain) or deletes data. Everything else, decide and log it in `PROGRESS.md`.
- Never send real emails to anyone except admin@afterwave.org.
- Follow `design-system/` exactly. Use paper, ink, greys and the one orange, with orange dither details only where the mockup has them. Never use em dashes in any copy.
- Port all website copy word for word from the prototype, in both languages.

## When you finish
Post a summary with:
- the live URLs
- what's done and verified
- the final `BLOCKERS.md` list in plain steps
- anything you'd change next
