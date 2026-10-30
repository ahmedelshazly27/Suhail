# Suhail

The public website (Arabic at `/`, English at `/en`) and the team dashboard (`/team`, or `team.<domain>`), in one Next.js app on Supabase, Resend and Vercel. The spec is `PROMPT.md`, the plan is `PLAN.md`, the running log is `PROGRESS.md`, and what's waiting on the owner is `BLOCKERS.md`.

## Local setup

1. Install Node 22 and PostgreSQL 16 (`apt install postgresql` or Postgres.app).
2. `npm ci`
3. `scripts/local-supabase.sh` starts Postgres, Supabase Auth and PostgREST on `:54321`, applies every migration and writes `.env.test.local`.
4. `cp .env.test.local .env.local`
5. `npm run dev` and open http://localhost:3000.
6. Sign in to the dashboard at http://localhost:3000/team/sign-in with the owner email. Locally the link is printed in the server log because there's no mail key; in previews it arrives by email.
7. Optional sample data that matches the mockups: `psql -h /tmp -p 54322 -U postgres -f scripts/local/demo.sql` (local only).
8. Before a pull request: `npm run typecheck && npm run lint && npm run ds-check && npm run build && npx playwright test`.

## Where things are

| | |
|---|---|
| `design-system/` | tokens, component specs and voice rules. `npm run tokens` regenerates `tokens.json` and `emails/theme.ts`. |
| `app/(site)/[lang]` | public pages. Copy comes from `content/*.json`, extracted from the prototype by `scripts/extract-copy.mjs`. |
| `app/(team)/team` | the dashboard. `/team/design` shows every token and component. |
| `app/actions` | server actions. Every input is validated with zod; every query runs through RLS except public form writes, webhooks and cron. |
| `lib/m365` | Microsoft Graph behind typed interfaces, with sample adapters until Entra is connected. |
| `supabase/migrations` | schema and RLS. `scripts/db-push.mjs <ref>` applies them through the Management API. |
| `docs/` | Microsoft setup, Resend and operations. |
