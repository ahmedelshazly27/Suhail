# Resend

- **Domain:** `suhail.build` is verified in Resend (region eu-west-1) with sending enabled. All mail is sent from `hello@suhail.build`.
- **DNS** (already in place; keep them if the domain moves):
  - SPF: the `TXT` record Resend shows on the `send` subdomain (`v=spf1 include:amazonses.com ~all`) and the `MX` record for the same subdomain.
  - DKIM: the `TXT` record `resend._domainkey` with the public key from the Resend dashboard.
  - DMARC: `TXT _dmarc.suhail.build` with `v=DMARC1; p=none; rua=mailto:admin@afterwave.org` to start, then `p=quarantine` once reports are clean.
- **Segments:** "Suhail newsletter, Arabic" and "Suhail newsletter, English" (ids in `RESEND_AUDIENCE_ID_AR` and `_EN`). Supabase is the source of truth; confirmed subscribers are added to their language's segment.
- **Webhook:** `https://suhail-lemon.vercel.app/api/resend/webhook` for delivered, opened, clicked, bounced, complained and contact updates. Its signing secret is `RESEND_WEBHOOK_SECRET`.
- **Safety switch:** `MAIL_ALLOWLIST=admin@afterwave.org` means only that address gets real mail; everything else is redirected there with the intended recipient in the subject, and newsletter broadcasts are switched off. Set it to `*` in Vercel (Production) when Suhail is ready to email applicants and subscribers.
