# Blockers: things only you can do

Everything below is already built. Each piece runs behind a flag or a sample adapter and switches on once you finish its steps. Items marked **(costs money)** wait for your yes.

## 1. Register the Microsoft (Entra ID) app

**Redirect URI (production):** `https://sakcroiygqvshzaypxep.supabase.co/auth/v1/callback`
**Redirect URI (staging/previews):** `https://pmzjqczxidunkkdgdsfj.supabase.co/auth/v1/callback`

The full walkthrough, with every permission and why it's needed, is in `docs/microsoft.md`. Short version:
1. In entra.microsoft.com, go to App registrations and choose New registration. Name it `Suhail` and pick "Accounts in this organizational directory only".
2. Add both redirect URIs above as **Web** platform URIs.
3. Under Certificates & secrets, create a new client secret (24 months) and copy its value.
4. Under API permissions, add the delegated and application permissions listed in `docs/microsoft.md`, then choose **Grant admin consent**.
5. Under Token configuration, add a groups claim for security groups.
6. Create the security groups `suhail-owners`, `suhail-admins` and `suhail-team`, and add yourself to `suhail-owners`. Copy each group's Object ID.
7. In Supabase (both projects), go to Authentication, then Providers, then Azure. Turn it on and paste the client ID, the secret and the tenant URL `https://login.microsoftonline.com/<tenant-id>`.
8. In Vercel (Production and Preview), add `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and the three group Object IDs as `AZURE_GROUP_OWNERS`, `AZURE_GROUP_ADMINS` and `AZURE_GROUP_TEAM`. Then redeploy.

**Until then:** the "Sign in with Microsoft" button is hidden. On previews, the owner signs in at `/team/sign-in` with an email link sent only to admin@afterwave.org (flag `DEV_LOGIN`, which is forced off in Production). Drive, Mail, Calendar, Directory and Teams use clearly labelled sample data.

## 2. SharePoint drive, shared mailboxes, tasks@ inbox
These need item 1 first.
1. Open the SharePoint site's Documents library and copy its drive ID (the Graph Explorer query is in `docs/microsoft.md`). Set it as `SHAREPOINT_DRIVE_ID`.
2. Set `SHARED_MAILBOXES` to a comma-separated list, for example `hello@suhail.build,careers@suhail.build`.
3. Create a `tasks@` mailbox (or alias) and set `TASKS_MAILBOX`. Emails sent there become tickets.

## 3. Teams notifications and bot (off until set)
1. In the team channel, open Workflows and choose "Post to a channel when a webhook request is received". Copy the URL into `TEAMS_WEBHOOK_URL`.
2. For the bot, which takes commands like `ticket <title>`: create an Azure Bot resource (the free F0 tier) with messaging endpoint `https://suhail-lemon.vercel.app/api/teams/messages`. Set `MICROSOFT_BOT_ID` and `MICROSOFT_BOT_PASSWORD`, then install the app in Teams.

## 4. Cloudflare Turnstile real keys
Right now the forms use Cloudflare's published test keys, which always pass, so bots are held back only by the per-IP rate limits. Production logs a warning until real keys are set. Please do this one soon. To switch to real keys:
1. In the Cloudflare dashboard, go to Turnstile and add a site (it's free). Add the domain `suhail-lemon.vercel.app` and your custom domain later.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel (Production), then redeploy.

## 5. Let real emails go out
To keep things safe, any email to an address other than admin@afterwave.org is redirected to admin@afterwave.org, and newsletter broadcasts are disabled. When you're ready to go live:
1. In Vercel (Production), set `MAIL_ALLOWLIST` to `*`, then redeploy.

## 6. GitHub secret for automatic migrations
1. In GitHub, open Suhail, then Settings, then Secrets and variables, then Actions, and choose New repository secret.
2. Name it `SUPABASE_ACCESS_TOKEN`. Use a personal access token from the Suhail Supabase account (supabase.com/dashboard/account/tokens).

After that, every merge to main applies new migrations to production. Until then I apply them by hand, and the CI job skips them.

## 7. Network access for this coding environment (optional)
This container can't reach `*.supabase.co` or `*.vercel.app`, so I verify live deployments through the Vercel and Supabase APIs instead of opening them directly. To let me test the live sites end to end, add both hosts to the environment's allowed network hosts.

## 8. Custom domains (needs you, maybe costs money)
1. Choose the public domain (for example `suhail.build`, which you already own on Resend's side) and a team host such as `team.suhail.build`.
2. In Vercel, go to the Suhail project, then Domains, add both and create the DNS records it shows.
3. Set `NEXT_PUBLIC_SITE_URL` to `https://suhail.build` and `TEAM_HOST` to `team.suhail.build`. Then update the Supabase Auth site URL, the Resend webhook URL and the Teams bot endpoint.

## 9. Paid upgrades (costs money, ask first)
- **Vercel Pro:** Hobby allows one daily cron, so digests and reminders run once a day at 05:30 UTC. Pro allows hourly runs. Pro is also required for commercial use.
- **Supabase Pro:** adds daily backups and point-in-time recovery for production. Free has no backups, so I'd recommend Pro before real applicant data arrives.
