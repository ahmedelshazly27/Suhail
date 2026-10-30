# Suhail build plan

Source of truth: `PROMPT.md`. This plan turns it into a schema, routes, phases and checks, adjusted for what the prototype and the mockups show.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict | One app. `app/(site)` public, `app/(team)` dashboard |
| Styling | Tailwind 4, theme mapped to `design-system/tokens.css` variables, default palette disabled | `@theme inline` with `--color-*: initial` |
| Data | Supabase (Postgres, Auth, Storage, Realtime) via `@supabase/ssr` | Server actions for every mutation, zod on every input |
| Email | Resend + React Email, sending from `suhail.build` (verified) | `emails/theme.ts` generated from `tokens.json` |
| Rich text | Tiptap | Descriptions, comments, docs, newsletter body |
| Drag and drop | dnd-kit | Boards, sprint planning |
| Palette | cmdk | Cmd+K, `C` for new ticket |
| Bot protection | Cloudflare Turnstile (test keys until real ones) + per-IP rate limit in a Supabase table | |
| Tests | Playwright (1440 and 390, light and dark, ar and en), axe, Lighthouse CI | |

## Environments

| | Supabase | Vercel |
|---|---|---|
| Local | staging project (`pmzjqczxidunkkdgdsfj`) | `next dev` |
| Preview (every PR) | staging | Preview env vars |
| Production (`main`) | production project (`sakcroiygqvshzaypxep`) | Production env vars |

Both projects live in the `Suhail` Supabase org. Migrations are in `supabase/migrations` and applied to both with `scripts/db-push.mjs` (Management API) in CI on merge to `main`.

## Routes

### Public (`app/(site)/[lang]`)
Arabic is the default and lives at `/`; English lives at `/en`. Middleware rewrites un-prefixed paths to `/ar/...` internally, so URLs stay clean. `hreflang` pairs every page.

| Path | Prototype section |
|---|---|
| `/` | home, inline newsletter signup |
| `/manifesto` | manifesto |
| `/season` | Suhail Season (conference) |
| `/hackathons` | hackathons list |
| `/hackathons/[id]` | event page (agenda + hackathon form) |
| `/house` | Al Freej |
| `/podcast` | The Majlis |
| `/partners` | partnerships |
| `/jobs` | opportunities board (talent, co-founder, company forms in a modal) |
| `/careers` | open roles from the database, each with its own form |
| `/newsletter/confirm`, `/newsletter/unsubscribe` | double opt-in and one-click unsubscribe |

The prototype's "inbox" page is not ported. The prototype hides nav links for "coming soon" pages; the header shows only Manifesto and Join the team, as in the prototype, and the soon pages keep their "Coming soon" bar.

### Dashboard (`app/(team)/team`)
Served at `/team` everywhere, and at `team.<domain>` through a middleware host rewrite.

| Path | Mockup |
|---|---|
| `/team/sign-in`, `/team/welcome` | SignIn.dc.html (both steps) |
| `/team` | Main.dc.html (Home) |
| `/team/inbox` | Inbox.dc.html (Outlook mail; notifications live in a tab) |
| `/team/my-work` | My work |
| `/team/projects`, `/team/projects/[key]` | Board.dc.html with ticket peek |
| `/team/tickets/[key]` | full-page ticket |
| `/team/sprints` | Sprint.dc.html |
| `/team/applications`, `/team/applications/[id]` | Applications.dc.html |
| `/team/relationships` | Relationships.dc.html |
| `/team/content` | Content.dc.html |
| `/team/newsletter` | Newsletter.dc.html |
| `/team/drive` | Drive.dc.html |
| `/team/finance` | Finance.dc.html |
| `/team/settings/*` | members, pipelines, roles editor, templates, labels, sprints, Teams, M365 toggles, retention |
| `/team/design` | living design-system specimen |

### API
`/api/resend/webhook`, `/api/graph/notifications` (mail change subscription for `tasks@`), `/api/teams/messages` (bot), `/api/cron/*` (digest, stand-up, weekly digest, retention), `/api/ics/[token]` and `/api/ics/team/[token]`, `/auth/callback`.

## Schema

All tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger), and `created_by uuid references profiles` on mutable records. Soft delete (`deleted_at`) on `applications` and `tickets`.

**Team**
- `profiles` (id = auth.users.id, email, name, job_title, avatar_path, team_role `owner|admin|member`, ms_oid, groups text[], lang, settings jsonb, digest_email bool, standup_enabled bool, ics_token, active bool)
- `team_roles` (key, label, description, sort): owner, admin, member, plus job functions (finance lead, editor) used for Drive and approvals
- `graph_tokens` (profile_id, encrypted refresh token, expires_at). Service role only.

**Recruiting**
- `forms` (key: careers, hack, house, talent, cofounder, company, season, partner, podcast; pipeline stages jsonb; email_template keys)
- `roles` (slug, title_en/ar, plain_en/ar, pitch_en/ar, do jsonb, you jsonb, form_schema jsonb, rubric jsonb, status open|closed, sort)
- `applications` (form_key, role_id, stage, assignee_id, score numeric, answers jsonb, email, name, cv_path, cv_url, lang, tags text[], duplicate_of, source_ip_hash, deleted_at)
- `application_notes`, `rubric_scores` (application_id, profile_id, criterion, score 1..5)
- `hackathons` (slug, title, city, fmt, scene, desc, agenda jsonb, published). Draft rows from `EVENTS_DRAFT`; public list stays empty like the prototype until published.

**Newsletter and email**
- `subscribers` (email unique, lang, sources text[], topics text[], status pending|active|unsubscribed|bounced, confirm_token, unsubscribe_token, confirmed_at, unsubscribed_at, resend_contact_id)
- `newsletter_issues` (title, subject_ar/en, body_ar/en jsonb (Tiptap), status draft|scheduled|sent, scheduled_at, sent_at, broadcast_ids jsonb, segment)
- `email_templates` (key, subject_ar/en, body_ar/en), `email_log` (to, template, subject, entity_type, entity_id, resend_id, status), `email_events` (resend_id, type, payload, issue_id)

**Work**
- `projects` (key, name, lead_id, status, target_date, description jsonb, doc jsonb, budget numeric, currency, sharepoint_folder_url, template_key)
- `sprints` (number, name, starts_on, ends_on, capacity jsonb, status planned|active|done)
- `tickets` (number serial, key generated `SUH-n`, title, description jsonb, status, priority, assignee_id, project_id, sprint_id, parent_id, due_on, estimate, labels uuid[], flagged, source, source_ref, deleted_at)
- `labels`, `comments` (polymorphic: entity_type, entity_id, body jsonb, mentions uuid[]), `activity` (append-only: entity_type, entity_id, actor_id, verb, data), `notifications` (profile_id, kind, entity, read_at, snoozed_until), `saved_views` (profile_id, list, layout table|board|list, filters, group_by, sort)
- `project_templates` (key, name, items jsonb: title, offset_days, role, estimate) seeded with Hackathon, Event, Podcast episode, Newsletter issue, Research release

**Workspaces**
- `organisations`, `contacts`, `relationships` (org/contact, type, stage, owner_id, next_step, next_due, project_ids), `relationship_events` (timeline)
- `content_items` (channel, title, status, publish_on, owner_id, reviewer_id, project_id, issue_id)
- `expense_categories`, `expenses` (project_id, amount, currency, category, receipt_url, status pending|approved|rejected|paid, approver_id, decided_at)
- `file_links` (drive item id, web url, name, kind, entity_type, entity_id): "Used in"
- `mail_links` (message id, mailbox, subject, from, received_at, entity_type, entity_id): metadata only, no bodies
- `standups` (profile_id, sprint_id, day, done, next, blockers, blocker_ticket_id)
- `settings` (single row of jsonb: sprint length, Teams channel, stand-up time and days, retention months, feature toggles)
- `rate_limits` (bucket, key hash, window start, count)

**Storage buckets**: `cvs` (private), `receipts` (private, fallback when SharePoint is off), `avatars` (public).

## Security model

- Helper SQL functions: `is_team()`, `is_admin()` (owner or admin), `is_owner()`, `is_finance()`, all `security definer`, reading `profiles` for `auth.uid()` where `active`.
- Every table has RLS on. Anonymous users get no policies at all. Public forms insert through server actions using the service role after zod validation, Turnstile and the rate limit, so the anon key cannot write or read anything.
- Team members: select/insert/update on dashboard tables. Settings, roles, templates, members, pipelines: admin only. Activity: insert and select only. Finance approvals: finance or admin. `graph_tokens`, `rate_limits`: no policies (service role only).
- CVs: private bucket, no storage policies for anon or authenticated; signed URLs (60 s) minted server-side after an `is_team()` check.

## Auth

- Production: Supabase Azure provider, single tenant (`AZURE_TENANT_ID` in the issuer URL), scopes `openid email profile offline_access User.Read`. On callback, the server reads `/me`, `/me/memberOf` and `/me/photo`, maps `suhail-owners|admins|team` to `team_role`, upserts `profiles`, and deactivates anyone not in a group. Middleware re-checks `active` on each request.
- Until `AZURE_*` exists: `DEV_LOGIN=1` enables an email magic link restricted to `admin@afterwave.org` (server-side allowlist). It is never set in Production.
- Graph features sit behind interfaces in `lib/m365/` (`MailProvider`, `DirectoryProvider`, `DriveProvider`, `CalendarProvider`, `TeamsNotifier`, `TodoProvider`) with a `mock` adapter and a `graph` adapter, chosen by `isM365Enabled()` (all `AZURE_*` set plus the toggle in Settings).

## Phases and acceptance checks

Each phase ships on a short branch, merged to `main` when CI is green.

1. **Foundation.** Next app, tokens and Tailwind mapping, `components/ui` primitives, `/team/design`, design-system lint (no raw hex/font names/px radii outside `design-system/`, no physical direction properties, no em dashes in copy), migrations with RLS on staging and production, buckets, seed, GitHub Actions (typecheck, lint, ds-check, build, Playwright smoke), Vercel project with env vars.
   *Check:* CI green; `/team/design` renders in 4 modes; `select` as anon returns nothing on every table.
2. **Public site.** Every page in ar and en with ASCII scenes, the three polaroid photos, marquee, modal, hreflang, sitemap, robots, OG images.
   *Check:* side-by-side screenshots against `reference/suhail.html` at 1440 and 390 in both languages show no layout difference; copy diff against the prototype strings is empty.
3. **Forms.** Every form in `FORMS` plus careers from `roles.form_schema`; CV upload to the private bucket; Turnstile; rate limit; bilingual confirmation email; team notification (in-app + Teams if set).
   *Check:* a careers application with a PDF lands in `applications` with `cv_path`; confirmation goes to admin@afterwave.org only; the 6th submission in a minute from one IP is refused.
4. **Dashboard shell.** Sign in (Microsoft or `DEV_LOGIN`), welcome screen, sidebar, Cmd+K, peek panel, saved views (table, board, list), mobile tab bar and bottom sheets, PWA manifest.
   *Check:* owner signs in; non-allowlisted email is refused; Cmd+K opens and navigates; `Esc` closes panels.
5. **Applications.** Pipelines per form, board per role, combined table, detail with CV preview, rubric, notes with mentions, activity, bulk actions, templated email with preview and log, duplicate detection, CSV export.
6. **Newsletter.** Double opt-in, unsubscribe page and `List-Unsubscribe`, Resend Audiences (ar, en) sync, Tiptap composer with RTL preview, test send, broadcast by language, webhook stats.
7. **Projects.** Tickets, kanban with grouping and swimlanes, sprints with capacity and rollover, My work, notifications, `C` quick capture.
8. **Workspaces and M365 v1.** Templates, relationships, content calendar, budgets and expenses, project docs, people picker, Teams webhook cards and bot, stand-up, email to ticket, ICS feeds, Drive, SharePoint search, weekly digest. Mock adapters until Azure credentials exist.
9. **Hardening.** axe clean, Lighthouse 95+ on the public site, RTL pass, RLS and server action review, Sentry-compatible error hook, backups noted, `docs/`.

## Decisions made up front

- Public URLs: Arabic at `/`, English at `/en`, because the prototype defaults to Arabic and search engines need a separate URL per language for `hreflang`.
- Tokens: the mockups use `#3A3530` for secondary ink and an orange inline-start bar for the active nav item. I add `--fg-2` to `tokens.css` and update `components.md` so the system matches the approved mockup.
- Rate limiting uses a Supabase table instead of Upstash to avoid another paid account.
- Microsoft scopes and Teams features are built against interfaces with mocks, so the dashboard is fully usable before Entra is registered.
