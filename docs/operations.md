# Operations

- **Environments:** Production (`main`) uses Supabase `suhail-production` (`sakcroiygqvshzaypxep`). Previews use `suhail-staging` (`pmzjqczxidunkkdgdsfj`). Both are on the Free plan in the Suhail org, region eu-west-1.
- **Migrations:** add a file to `supabase/migrations`, then `SUPABASE_ACCESS_TOKEN=... node scripts/db-push.mjs <ref>` for staging, then production. CI does this on every push to `main` once the `SUPABASE_ACCESS_TOKEN` repository secret exists.
- **Backups:** the Free plan has no automatic backups you can restore yourself. Until Suhail moves to Pro (daily backups, 7 days), take a weekly dump: `pg_dump "$(supabase db url)" > suhail-$(date +%F).sql` and keep it in SharePoint `Finance`-level restricted storage.
- **Cron:** `/api/cron/daily` at 05:30 UTC (08:30 Kuwait): stand-up prompt, due and overdue cards, email digests, Monday weekly digest, retention, orphan CV cleanup, Graph subscription renewal. Hobby runs crons once a day; Pro allows the exact stand-up time from Settings.
- **Errors:** runtime errors appear in Vercel, Logs. Server actions throw readable messages that the dashboard shows as toasts.
- **Data retention:** "Not now" applications older than the setting (Settings, General) are soft-deleted with their answers and CVs removed.
