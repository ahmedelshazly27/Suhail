# Progress

## Done
- Spec committed as the first commit. PLAN.md written.
- **Infrastructure**
  - Supabase `suhail-production` (`sakcroiygqvshzaypxep`) and `suhail-staging` (`pmzjqczxidunkkdgdsfj`) are migrated and seeded with the five roles, forms, stages, templates and draft hackathons.
  - Resend is set up with the domain `suhail.build`, AR and EN segments, and a webhook.
  - Vercel: previews build on every PR and production deploys from main. Env vars are set for Preview and Production.
- **Public site:** every page is ported word for word from the prototype in Arabic (at `/`) and English (at `/en`), including the ASCII scenes, forms with CV upload, the newsletter with double opt-in and one-click unsubscribe, hackathons, jobs, sitemap, robots, OG images and the PWA manifest.
- **Dashboard**
  - Sign-in, the welcome screen and Home.
  - Inbox and My work.
  - Projects with templates and board, table, timeline, docs, files and budget tabs.
  - Tickets with an editor, mentions, a feed and peek. Sprints.
  - Applications pipeline with rubric scoring and templated email.
  - Relationships, content calendar, newsletter composer, drive, finance, settings, and the `/team/design` specimen.
  - Command palette (Cmd+K) and C quick capture.
  - EN and Gulf Arabic, light and dark.
- **Integrations, all behind flags:** Microsoft Graph adapters, the Teams webhook and bot, ICS feeds, a daily cron and Graph notifications.
- **Checks**
  - Typecheck, lint and `ds-check` (the design-system guard) pass.
  - 207 Playwright tests cover desktop 1440 and phone 390, light and dark, AR and EN, with axe and overflow checks on every screen, plus RLS tests.

## Next
- Production: apply the tour migration, merge this branch to main and redeploy (BLOCKERS item 1).
- `/season` mobile performance (it varies between about 72 and 94 from run to run), then the visual RTL review of every Arabic screen.

## Done on 30 October
- **Fonts.** Newsreader, Amiri and IBM Plex Sans Arabic are self-hosted (`styles/fonts.css`), and each language preloads only its own H1 face. The Arabic files are subset to the core Arabic block (`scripts/subset-fonts.py`), about a third smaller. The Arabic wordmark is an SVG of the same Amiri Bold glyphs. Mobile Lighthouse on the Arabic home went from 80 to 95 to 97, and most other pages score 93 to 99.
- **First-sign-in tour** (`components/team/Tour.tsx`) after the "You're in" screen. It can be replayed from Settings. Tested in both languages on desktop and phone.
- **Hosts.** `suhail.build` is the public site and `team.suhail.build` the dashboard. Sign-in callbacks and dashboard links use `env.teamUrl()`.
- **Microsoft Entra** is configured through Graph with the owner's approval (BLOCKERS item 1). The owner address is now a.elshazly@suhail.build.

## Decisions
- **Supabase account.** The MCP connector points at a personal account whose Free plan was full. I use the Suhail account from the network settings, as you said.
- **Production project reuse.** I renamed the Suhail org's one empty project to `suhail-production` instead of deleting it, which keeps within the Free plan's two projects.
- **Vercel Hobby** (free). The one daily cron at 05:30 UTC (`/api/cron/daily`) handles digests, due reminders, recurring tickets and Graph subscription renewal. Hourly runs would need Pro.
- **Email safety switch.** Any email to an address other than those in `MAIL_ALLOWLIST` (default `admin@afterwave.org`) is redirected to `MAIL_SAFE_TO`. Broadcasts are disabled unless the allowlist is `*`.
- **Microsoft 365** sits behind typed interfaces (`lib/m365`) with Graph and sample adapters. The sample adapter runs until `AZURE_*` is set, and its data is labelled as sample in the UI.
- **DEV_LOGIN** sends an owner-only email link to admin@afterwave.org. It is on in Preview and forced off in Production by code, whatever the variable says.
- **Public writes** go through server actions using the service role, with zod validation, rate limits and Turnstile. Anonymous users have no table grants. `graph_tokens` and `rate_limits` are service-only. CVs live in a private bucket and open only through short signed URLs. They upload directly to storage, because Vercel limits request bodies to 4.5 MB.
- **Turnstile** uses Cloudflare's test keys until real keys are set. E2E tests bypass it only when `E2E=1` and not on Vercel.
- **Local test stack.** Docker registries are blocked here, so `scripts/local-supabase.sh` runs Postgres, GoTrue and PostgREST from release binaries. CI uses the same script, so dashboard and RLS tests need no secrets. The stack's demo data (`scripts/local/demo.sql`) is local only.
- **Fidelity details**
  - The prototype relies on the browser's default 8px body margin, and I kept it so the layout matches pixel for pixel.
  - The em dashes in the prototype copy became en dashes, per the no-em-dash rule.
- **Quick capture** (C) assigns the new ticket to its creator, so it shows up in My work right away.
- **Role-form preview CSS** (`styles/form-preview.css`) is generated from the site CSS, so the settings preview matches the public form exactly.
- **Tailwind 4** runs without preflight and maps only the design tokens. The component CSS lives in `styles/*.css`.
- **Contrast (WCAG AA) wins over three exact mockup colours.**
  - The light theme's `--muted` changed from `#7A736A` (4.32:1 on paper) to `#716A61` (4.93:1).
  - Small orange text uses `--accent-ink`, the design system's own text form of the orange; borders, dots and headline highlights keep `--accent`.
  - The prototype's ghosted placeholder text used `--faint` (2:1) and now uses `--muted`.
  - Inside the dark band, secondary text is a 60/40 mix of the band's foreground and background.
  - Colour-contrast is now enforced by the axe checks in both test suites.
- **Heading order.** A few H3s in the prototype skipped a level. They're now H2s that look exactly like H3s (`h2.h3`).
- **Fonts.** Only Newsreader is preloaded, with `display: optional`. Amiri, Plex, Plex Arabic and Plex Mono load on demand, so English pages skip the Arabic files and vice versa. That's about 470 KB less up front.
- **Scenes.** The ASCII scenes start once the browser is idle, and they read colours and font once per size or theme change instead of every frame.
- **Client bundle.** zod and the Supabase client are no longer in the public-site bundle: the Supabase client loads only when someone attaches a CV.
- **Lighthouse on the local production build** (this container can't reach vercel.app):
  - Desktop: performance 98, accessibility 100.
  - Mobile accessibility: 100 on every page in both languages.
  - Best practices: 96 here, only because the container's proxy blocks the Turnstile script.
  - SEO: 100 in Production. Outside Production it's lower because robots is noindex there on purpose.
  - Mobile performance (simulated slow 4G with 4× CPU) is 64 to 90. With real throttling, LCP is about 1.9s and the remaining cost is React hydration plus the canvas scenes.
  - Reaching 95 on every page needs structural work: server-only static sections, and a glyph-atlas renderer for the scenes. That's listed as the top next step.
- **Security review (independent pass over every RLS policy, server action and route).** Fixed:
  - Roles now come from Entra group object IDs, not display names.
  - A daily access re-check switches off anyone removed from the groups or disabled in Entra.
  - Identity and integration columns on profiles (email, Microsoft IDs, Teams reference, calendar token) are server-managed.
  - Postgres's default PUBLIC execute grant is revoked on the helper functions and the rate limiter.
  - Teammates can no longer insert notifications for each other.
  - Finance can't approve their own expenses (owners can), in RLS and in the Teams bot.
  - The Teams bot only trusts a `serviceUrl` that matches its signed token and is a Bot Framework host.
  - Graph change notifications use an HMAC-derived `clientState`, compared in constant time.
  - Application confirmation emails include only a letters-only first name.
  - Covered by a new RLS e2e test. The migration is applied to staging and production.
- **Turnstile stays on Cloudflare's test keys until real ones are set.** Failing closed would break the live forms today. Production logs a warning instead, and it's in BLOCKERS.
