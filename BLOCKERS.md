# Blockers: things only you can do

Everything below is already built. Each piece runs behind a flag or a sample adapter and switches on once you finish its steps. Items marked **(costs money)** wait for your yes.

## 1. Microsoft sign-in: done on 30 October, one approval left
The Suhail app registration (single tenant, both Supabase redirect URIs, groups claim, all Graph permissions with admin consent), a client secret valid until 30 October 2028, and the groups `suhail-owners` (a.elshazly@suhail.build), `suhail-admins` and `suhail-team` are set up. The `AZURE_*` variables are in Vercel (Production and Preview), and Azure sign-in is on in both Supabase projects with `team.suhail.build` as the site URL.

**Still needs your approval:**
1. Apply `supabase/migrations/20261031090000_tour.sql` to production (it's already on staging). Or add the `SUPABASE_ACCESS_TOKEN` GitHub secret (item 6) so merges to main apply it.
2. Merge `claude/suhail-continuation-mw9vw9` into main so production gets the team-host sign-in fix and the tour, and redeploy so the new variables take effect.

The rest of the Microsoft setup (shared mailboxes, SharePoint, Teams bot) is in `docs/microsoft.md`, steps 4 to 9.

## 2. Domains: done
`suhail.build`, `www.suhail.build` (redirects to `suhail.build`) and `team.suhail.build` are attached and verified. `NEXT_PUBLIC_SITE_URL`, `TEAM_HOST`, `OWNER_EMAIL`, `MAIL_SAFE_TO` and `MAIL_ALLOWLIST` are set. Still to do: in Resend, Webhooks, change the endpoint to `https://suhail.build/api/resend/webhook`.

## 3. Shared mailboxes and tasks@
Part of `docs/microsoft.md`, steps 4 to 6: `hello@`, `partners@`, `careers@` and `tasks@`, limited to `tasks@` for the app's own mail access, and the SharePoint drive ID.

## 4. Cloudflare Turnstile real keys
Right now the forms use Cloudflare's published test keys, which always pass, so bots are held back only by the per-IP rate limits. Production logs a warning until real keys are set. Please do this one soon. To switch to real keys:
1. In the Cloudflare dashboard, go to Turnstile and add a site (it's free). Add the domains `suhail.build`, `team.suhail.build` and `suhail-lemon.vercel.app`.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel (Production), then redeploy.

## 5. Let real emails go out
To keep things safe, any email to an address other than a.elshazly@suhail.build is redirected to a.elshazly@suhail.build, and newsletter broadcasts are disabled. When you're ready to go live:
1. In Vercel (Production), set `MAIL_ALLOWLIST` to `*`, then redeploy.

## 6. GitHub secret for automatic migrations
1. In GitHub, open Suhail, then Settings, then Secrets and variables, then Actions, and choose New repository secret.
2. Name it `SUPABASE_ACCESS_TOKEN`. Use a personal access token from the Suhail Supabase account (supabase.com/dashboard/account/tokens).

After that, every merge to main applies new migrations to production. Until then I apply them by hand, and the CI job skips them.

## 7. Network access for this coding environment (optional)
This container can't reach `*.supabase.co` or `*.vercel.app`, so I verify live deployments through the Vercel and Supabase APIs instead of opening them directly. To let me test the live sites end to end, add both hosts to the environment's allowed network hosts.

## 8. Paid upgrades (costs money, ask first)
- **Vercel Pro:** Hobby allows one daily cron, so digests and reminders run once a day at 05:30 UTC. Pro allows hourly runs. Pro is also required for commercial use.
- **Supabase Pro:** adds daily backups and point-in-time recovery for production. Free has no backups, so I'd recommend Pro before real applicant data arrives.
