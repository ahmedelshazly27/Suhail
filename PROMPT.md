# Build Suhail: public website + internal team dashboard

You are building the production version of Suhail (سهيل), a builder ecosystem for the Arab world. There are two parts:

1. **The public website.** It already exists as a working single-file prototype: `reference/suhail.html` in this repo. Port it faithfully.
2. **An internal dashboard** for the team to manage applications, the newsletter, and our own projects.

Stack: **GitHub** (code), **Vercel** (hosting), **Supabase** (Postgres, Auth, Storage, Realtime), **Resend** (email), and **Microsoft Entra ID** for team sign-in. The team uses Microsoft 365 Business Basic accounts.

Before writing code, read `reference/suhail.html` end to end, then read everything in `design-system/`. The approved dashboard mockup is in `reference/dashboard-mockup/`, one HTML file per screen (Sign in, Shared drive, Home, Inbox, Project board with ticket panel, Sprint planning, Applications, Relationships, Content calendar, Newsletter, Budget and expenses, Command palette). Match its layout and behaviour. Then write `PLAN.md` with the schema, routes and phases below, adjusted for anything you learn. Then build phase by phase. Commit after each working step. Ask me before creating anything that costs money, before any destructive database change, and before sending any real email.

---

## 0. Ground rules

- **Language.** The site is bilingual Arabic and English, with Arabic as RTL and a language toggle. Keep the existing copy exactly as written in the prototype. It was edited carefully.
- **Writing style.** In any new copy you write, never use em dashes, and avoid marketing filler. Roles are described as "unpaid until revenue", never "volunteer".
- **Design.** The dashboard stays on brand: paper, ink, greys and the one orange, with no other hues, plus a few faded dither details as described in `design-system/README.md` and shown in the mockup. Keep the prototype's visual identity: colors, type, spacing, and the paper/ink look. Port it into components. Don't redesign it. The dashboard uses the same tokens in a calmer, denser layout.
- **Quality.** TypeScript strict mode, server-side validation with zod on every form, and Row Level Security on every table. No secrets in the client.
- **Accessibility and mobile.** Everything must work at 375px wide. Use proper labels and focus states, and check that keyboard navigation works in both directions (LTR and RTL).

## 0b. Design system (do this first)

The Suhail design system is in `design-system/`: `README.md` (principles, type, RTL, voice), `components.md` (exact component specs), `tokens.css`, `tokens.json` and `logo-mark.svg`. It was extracted from the prototype. It's the single source of truth for the website, the dashboard and the emails.

- Keep `design-system/` at the repo root as the canonical source. Import `tokens.css` once in the root layout.
- Map the Tailwind theme to the CSS variables (colors, fonts, radii, spacing), so `bg-bg`, `text-fg`, `text-muted`, `border-line`, `rounded-card` and similar classes resolve to tokens. Don't use Tailwind's default palette. Disable it.
- Build the shared primitives in `components/ui/` exactly to `components.md`: Button, Pill, SoonTag, Label, Eyebrow, Card, Field (input, textarea, select, checks, file picker, word counter), Quote, Modal, DarkBand, Marquee, Sidebar, Table, Board column and card, Peek panel, Command palette, Avatar, Toast, Empty state. shadcn/ui is fine underneath, but restyle it to the spec.
- React Email templates use a small `emails/theme.ts` generated from `tokens.json`.
- Load fonts with `next/font` (Newsreader, IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Mono, Amiri), switching by `lang`.
- **Enforcement in CI:**
  - fail on any raw hex color, font-family name or px border-radius outside `design-system/`
  - fail on physical direction properties (`left`, `right`, `margin-left` and similar)
  - fail on em dashes in copy files
- Build `/team/design`, a living specimen of every token and component in light, dark, Arabic and English. Every UI pull request should be checked against it.
- If a screen needs something the system doesn't cover, add the token or component to `design-system/` first, document it, and then use it. Don't create one-off styles.

## 1. Architecture

Use **one Next.js app** (latest stable, App Router), not a monorepo:

- `app/(site)/...` is the public website at the main domain.
- `app/(team)/...` is the dashboard, served at `team.<domain>` through middleware host rewriting. It must also work at `/team` on preview deployments.
- Use Tailwind with the prototype's tokens moved into CSS variables, and shadcn/ui primitives restyled to match.
- Data access: use Supabase SSR helpers, server actions for mutations, and Realtime for boards and the inbox.
- Use dnd-kit for drag and drop, Tiptap for rich text (descriptions, comments, newsletter body), cmdk for the command palette, and React Email for email templates.
- Protect public forms with Cloudflare Turnstile plus a per-IP rate limit (Upstash, or a Supabase table if that's simpler).

## 2. Public website (port of the prototype)

Recreate every page in the prototype, each with its own route:

- home (with the inline newsletter signup form; there is no separate newsletter page)
- manifesto
- season
- hackathons
- event
- Al Freej (الفريج), the house program
- podcast (The Majlis)
- partners
- jobs
- careers

Footer: keep it as in the prototype. Do not add the domain text or a "Submissions" link.

**Careers.** Open roles currently live in the prototype as `ROLES_OPEN`: Partnerships, Events and Programming, Editorial, Engineering and Research, Finance.
- Move roles into the database so the team can open, close, edit and reorder them from the dashboard.
- Each role keeps its own application form: shared basics, then that role's specific task (`ROLE_FORMS` in the prototype), then the shared closing fields.
- Store each role's form schema as JSON on the role row, so new roles can get custom questions without a deploy.
- Keep word counters, required fields, the custom file picker, and the "CV upload or CV link" choice.

**Other forms.** Port the other forms in the prototype too: hackathon applications (`hack_apps`), Al Freej applications (`house_apps`), and newsletter (`subscribers`). Anything else you find in `FORMS` should come across as well.

**Uploads.** CVs go to a private Supabase Storage bucket. Only the dashboard can read them, through short-lived signed URLs.

**After submitting.** The applicant gets a bilingual confirmation email through Resend. The team gets a notification (see section 5).

**SEO.** Proper metadata in both languages, Open Graph images, sitemap, robots, and `hreflang`.

The prototype's "inbox" page was only a stand-in for the dashboard. Do not port it.

## 3. Dashboard: optimal shape

Design it to feel like Notion or Linear: calm, fast and keyboard friendly.

- **Navigation.** A left sidebar with Inbox, Applications, Newsletter, Projects, My work and Settings.
- **Command palette (Cmd+K).** Jump to anything, create a ticket, or search applicants.
- **Fast editing.** Inline editing everywhere: click a title to edit it, use `/` commands in rich text, press `Esc` to close panels.
- **Detail panels.** Every record opens in a side peek panel (like Notion), with a button to expand it to full page.
- **Saved views.** Every list can be shown as **Table**, **Board (kanban)** or **List**, with filters, grouping and sorting saved per user.
- **One shared component set.** Board, table, peek panel, comments and activity log are shared by applications and tickets. Build them once.

### 3a. Team sign-in with Microsoft
- Set up Supabase Auth with the **Azure (Entra ID)** provider, locked to our tenant only (single-tenant app registration). Accounts outside the tenant can't get in.
- **Access through Entra groups.** Create the security groups `suhail-owners`, `suhail-admins` and `suhail-team`. The app reads group membership on every sign-in and sets the role from it. Adding someone in Microsoft 365 gives them access, and disabling their account removes it. Roles are enforced in RLS, not just in the UI. I am the owner (admin@afterwave.org).
- **Make it seamless.**
  - Microsoft is the only way in: no passwords and no other providers.
  - Grant admin consent once at setup, so teammates never see a permissions prompt.
  - Store Graph tokens encrypted on the server and refresh them silently. Nobody should have to reconnect.
  - Inside the Teams tab, sign-in happens on its own through Teams SSO.
  - On first sign-in, show the short "You're in" screen from the mockup (`SignIn.dc.html`), listing what synced, then go straight to Home.
- On first sign-in, create a `profiles` row from Microsoft Graph: name, email, job title and photo (`/me/photo`).
- Write the setup steps in `docs/microsoft.md`: app registration, redirect URIs for production and preview, groups, every Graph permission with the reason for it, admin consent, and how to add or remove a teammate.

### 3b. Applications
- **Pipeline.** One pipeline per form type. Careers stages: New, Reviewing, Task review, Interview, Offer, Joined, Not now. Hackathon and Al Freej get similar, simpler stages that can be edited in Settings.
- **Board view per role**, plus a combined table across all roles.
- **Applicant detail:**
  - every answer, rendered nicely
  - CV preview (PDF inline) or the CV link
  - work links
  - the role-specific task answer highlighted
  - an assignee
  - a 1 to 5 score on a small rubric (rubric defined per role)
  - private team notes and @mentions
  - a full activity log
- **Bulk actions:** move stage, assign, tag, and send a templated email.
- **Email applicants from the dashboard through Resend**, using editable bilingual templates (received, interview invite, not now, offer). Preview before sending. Every send is logged on the applicant.
- **Duplicate detection** by email across forms.
- **CSV export.**

### 3c. Newsletter (Resend)
- **Subscribers** stored in Supabase as the source of truth: email, language, source page, status (`pending`, `active`, `unsubscribed`, `bounced`), and timestamps.
- **Double opt-in.** The confirmation email links back to the site to confirm. Every email has a one-click unsubscribe (`List-Unsubscribe` header plus a page).
- **Sync** to a Resend Audience (contacts API) so Resend can handle broadcasts and suppression.
- **Composer in the dashboard:**
  - write in Tiptap
  - separate Arabic and English versions with an RTL preview
  - live preview of the rendered React Email template
  - send a test to myself
  - schedule or send through the Resend Broadcasts API, segmented by language
- **Resend webhooks** for delivered, bounced, complained and opened events, stored in Supabase and shown as simple stats per issue.
- **Domain.** Write the domain verification steps (SPF, DKIM, DMARC) in `docs/resend.md`.

### 3d. Projects, tickets, sprints
Keep this lean, a small Linear rather than Jira.

- **Projects.** Name, lead, status, target date, description (rich text), and a progress bar computed from its tickets.
- **Tickets:**
  - short key (`SUH-123`) and title
  - rich description and status: Backlog, Todo, In progress, In review, Done, Cancelled
  - priority, assignee, labels, project, sprint, due date and estimate (points)
  - parent/sub-tickets
  - comments with @mentions and an activity log
- **Sprints (cycles).** Two-week cycles by default, configurable. Sprint planning view: backlog on the left, sprint on the right, drag tickets in, and see total points against the team's capacity. Unfinished tickets roll over to the next sprint with one click.
- **Kanban board** grouped by status (or by assignee or priority), with swimlanes by project.
- **My work.** Everything assigned to me across tickets and applications.
- **Quick capture.** Cmd+K, then "New ticket". Pressing `C` anywhere also creates one.

### 3e. Notifications
- **In-app inbox** for mentions, assignments, new applications and stage changes.
- **Email digest** (optional per user): a daily summary through Resend.

### 3f. Team workspaces
Suhail's work isn't only software. The project system must fit every team, using the same tickets, boards and sprints, plus a few workspace-specific views:

- **Templates.** A project can be created from a template that generates its tickets with relative due dates and owners by role. Seed these:
  - "Hackathon" (venue, sponsors, judges, comms, logistics, day-of, wrap-up)
  - "Event"
  - "Podcast episode" (guest, research, recording, edit, publish)
  - "Newsletter issue"
  - "Research release" (dataset, benchmark, model card, announcement)

  Templates are editable in Settings.
- **Relationships (light CRM)** for Partnerships, Events and the podcast. Organisations and people (sponsors, partners, speakers, guests, venues) move through a pipeline: Prospect, Contacted, In talks, Confirmed, Active, Past. Each has an owner, a next step with a date, linked projects and a timeline.
- **Content calendar** for Editorial. Posts, newsletter issues and episodes go on a calendar by channel (LinkedIn, Instagram, X, newsletter, podcast), with statuses Draft, In review, Approved, Scheduled and Published, and a one-click "request review".
- **Budget and expenses** for Finance. Projects get a budget. Teammates submit expenses with a receipt. Finance approves or rejects them, and spend against budget shows on the project.
- **Docs.** Each project has a rich-text page (Tiptap) for briefs, runbooks and notes, with `/` commands to embed tickets, boards and files.

### 3g. Microsoft 365 integration (Business Basic)
The goal is to make the team faster wherever they already work: Teams, Outlook, OneDrive and SharePoint. Every feature here works on Business Basic.

- Use Microsoft Graph from server code only, with delegated permissions when acting as the signed-in teammate and application permissions only for background jobs. Request the smallest scopes possible and list each one with its reason in `docs/microsoft.md`.
- Each feature has a toggle in Settings.

**v1:**
0. **Inbox.** Each teammate sees their own Outlook inbox and the shared mailboxes they have access to (such as `hello@`, `partners@` and `tasks@`) inside the dashboard, with a mailbox switcher, a message list and a reading pane.
   - **Actions:** Reply (sent through Outlook, so it lands in Sent), Create ticket, Link to partner, Assign to a teammate, Snooze, and Open in Outlook.
   - **Context panel:** messages from a known contact link to that relationship automatically, and the panel next to the email shows the linked partner, the linked tickets and earlier contact.
   - **Attachments** can be saved to SharePoint or attached to a ticket.
   - **Graph scopes:** delegated `Mail.ReadWrite` and `Mail.Send`, plus `Mail.Read.Shared` and `Mail.Send.Shared` for shared mailboxes.
   - **Storage:** don't copy mail bodies into Supabase. Store only message ids, links and the metadata needed for lists and linking, and fetch the body live.
1. **Directory people picker.** Assignees, owners and @mentions come from our organisation's directory (`User.ReadBasic.All`), with Microsoft photos and job titles.
2. **Teams as the notification hub.** Adaptive Cards in Teams for assignments, mentions, items due today or overdue, blocked tickets, approvals, and sprint start and end. Cards have actions: Open, Mark done, Comment, Snooze one day, Approve/Reject.
   - Personal notifications go to the person in a 1:1 chat with the app. Team-wide ones go to the channel.
   - Start with the Workflows webhook for the channel, and add a Teams bot (Azure Bot, free tier) for personal cards and actions.
3. **Async stand-up in Teams.** Each weekday at a set time, the bot asks every teammate three short questions in Teams: done, next, blockers. Answers are saved on their profile and in the sprint. Blockers create a flagged ticket for the project lead. One summary card is posted to the channel. Days and time are configurable and it can be turned off per person.
4. **Email to ticket.** Forward any email to a shared mailbox such as `tasks@` (free on Business Basic). It becomes a ticket with the email body and attachments, assigned to the sender, and the sender gets the ticket link back. Adding `#project-name` in the subject files it into that project. Works through a Graph change subscription on that one mailbox.
5. **Outlook calendar feed.** Every user gets a private calendar subscription URL (ICS), so their ticket due dates, sprint dates, events and content-calendar items show in Outlook. There's also one team feed for events and deadlines. No Graph permission is needed.
6. **Files from OneDrive and SharePoint.** Attach files to tickets, projects, relationships and docs with the Microsoft file picker, which links rather than uploads. Creating a project can optionally create a matching SharePoint folder, linked from the project page. Global search (Cmd+K) also searches our SharePoint files through the Graph search API.
7. **Weekly digest in Teams.** Every Monday morning a card goes to the channel with what shipped last week, what's due this week, sprint progress, overdue items and upcoming events.

**v2 (design for it now):**
8. **Meeting notes into tickets.** After a Teams meeting linked to a project, fetch the transcript through Graph, summarise it with the Claude API, and propose action items as draft tickets for the organiser to accept. Nothing is created without a person confirming.
9. **Capacity from calendars.** Sprint planning reads each person's Outlook free/busy and out-of-office time (`Calendars.ReadBasic`), and reduces their capacity for that sprint automatically.
10. **Teams presence** on avatars (`Presence.Read.All`).
11. **Microsoft To Do sync.** My assigned tickets appear in a "Suhail" list in To Do. Ticking one there marks it done here.
12. **Teams tab.** The dashboard (or one board) pinned as a tab in each team's channel, with Teams SSO.

### 3i. Shared drive
There is one general shared drive for the whole team, in addition to the folder each project gets. It's a SharePoint team site document library, "Suhail", shown inside the dashboard as **Drive** in the sidebar (see `Drive.dc.html` and the Drive tab in the phone prototype).
- **Top-level folders, created at setup:**
  - Brand: logo pack, fonts, brand guide, photo library, master deck
  - Templates: sponsor deck, partnership agreement, event run sheet, event budget, podcast guest brief
  - Partnerships
  - Events
  - Finance: restricted to owners and the Finance Lead
  - Team: onboarding, how we work, roles
  - Projects
- **Project folders.** Creating a project creates its folder inside `Projects/`, so the per-project folders and the general drive are one place, not two.
- **Permissions** follow the Microsoft 365 groups. Finance is restricted. Everything else is open to `suhail-team`, with edit rights per folder where needed (Brand: Layla and Ahmed).
- **In the dashboard:** a folder tree, Recent files, search across all files (including inside documents, through the Graph search API), Upload, New folder, and "New Word, Excel or PowerPoint". Opening a file edits it in Office on the web. A "Used in" column shows the tickets, partners, expenses or emails each file is attached to.
- **Attachments.** Files attached anywhere in the dashboard are links to the drive, never copies. Email attachments can be saved straight into a folder. Expense receipts go to `Finance/`.
- The same library shows up in Teams (Files tab), OneDrive and File Explorer, so people can work from wherever they are.

### 3j. Mobile
The dashboard must be fully usable on a phone. Use `reference/mobile-prototype.html` as the reference for the phone layout:
- a bottom tab bar (Home, Inbox, Work, Drive, More), a sticky header, and one column
- detail views (ticket, email, applicant, new ticket) open as bottom sheets
- approvals, marking done, stand-up and replies work with one thumb, with 44px+ targets and safe-area insets respected

Make it an installable PWA (manifest, icons from the star mark, theme colour). Desktop keeps the sidebar layout from the mockup.

### 3h. Settings
- Team members and roles
- Pipeline stages per form
- Role editor (open/close, copy, form schema editor with live preview)
- Email templates
- Labels
- Sprint length
- Teams settings (channel, bot, stand-up time), templates, expense categories

## 4. Data model (starting point, refine in PLAN.md)

| Area | Tables |
|---|---|
| Team | `profiles`, `team_roles` |
| Recruiting | `roles`, `applications` (type, role_id, stage, assignee, score, answers jsonb, cv_path, cv_url, lang), `application_notes`, `rubric_scores` |
| Newsletter | `subscribers`, `newsletter_issues`, `email_events`, `email_templates`, `email_log` |
| Work | `projects`, `tickets`, `sprints`, `ticket_labels`, `comments` (polymorphic: application or ticket), `activity` (append-only audit log), `notifications`, `saved_views` |

- Every table has `created_at` and `updated_at`.
- Mutable records have `created_by`.
- Use soft delete on applications and tickets.
- Write migrations with the Supabase CLI and commit them.
- Seed the database with the five current roles and their forms from the prototype.

## 5. Security

- RLS on everything. The public (anonymous) side can **insert** into `applications` and `subscribers` only, through a server action that validates and rate limits. It can't read anything.
- Team members can read and write the dashboard tables. Only owner and admin can change settings and roles.
- The CV bucket is private. Files are only accessible through signed URLs from server code.
- Verify Resend webhooks with their signature. Turnstile runs on every public form.
- Store applicant data only as long as needed. Add a setting to auto-delete "Not now" applications after N months.

## 6. Environments and deploy

- Create the GitHub repo `suhail` and connect it to Vercel. Previews run on every PR and production on `main`.
- Use separate Supabase projects for staging and production. Preview deployments use staging.
- Commit `.env.example` with every variable, including:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`, `RESEND_AUDIENCE_ID_AR`, `RESEND_AUDIENCE_ID_EN`, `RESEND_WEBHOOK_SECRET`
  - `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
  - `TEAMS_WEBHOOK_URL`, `TASKS_MAILBOX`, `MICROSOFT_BOT_ID`, `MICROSOFT_BOT_PASSWORD`, `ANTHROPIC_API_KEY` (v2, meeting notes only)
- If the Supabase and Vercel MCP tools are available in this session, use them. Otherwise use the CLIs.

## 7. Phases (each ends with something working on a preview URL)

1. **Foundation.** Repo, Next app, the design system installed and enforced (tokens, Tailwind mapping, primitives, `/team/design`), Supabase projects, migrations, RLS, CI with typecheck, lint and Playwright smoke tests.
2. **Public site.** Port all pages in AR and EN, responsive, and visually matching the prototype (screenshot compare at 1440 and 375).
3. **Forms.** All forms write to Supabase, CV upload works, confirmation emails go out, Turnstile and rate limiting are in place.
4. **Dashboard shell.** Microsoft sign-in locked to the tenant, sidebar, Cmd+K, peek panel, saved views.
5. **Applications.** Pipelines, boards, detail page, notes, scoring, templated emails, export.
6. **Newsletter.** Double opt-in, Resend sync, composer, broadcasts, webhooks, stats.
7. **Projects.** Tickets, kanban, sprints and planning, My work, notifications.
8. **Workspaces and Microsoft 365 v1.** Templates, relationships, content calendar, budgets and expenses, project docs, people picker, Teams cards and bot, async stand-up, email to ticket, calendar feeds, OneDrive/SharePoint files and search, weekly digest.
9. **Hardening.** Accessibility pass, Lighthouse 95+ on the public site, error tracking, backups noted, and docs in `docs/`.

## 8. Definition of done

- The public site matches the prototype in both languages on desktop and mobile.
- Submitting a careers application with a CV shows up within seconds on the role's board, with a Teams card and a confirmation email.
- When a ticket is assigned to me I get a Teams card and can mark it done from Teams. Forwarding an email to `tasks@` creates a ticket. My due dates show in Outlook.
- Creating a project from the Hackathon template generates its full checklist with dates and owners.
- Adding a teammate to the `suhail-team` group in Microsoft 365 gives them access. Removing them takes it away.
- I can sign in with my Microsoft account, and an account outside our tenant cannot.
- I can move an applicant across stages, score them, and email them from a template.
- I can write a bilingual newsletter, send it to myself as a test, then send it to the Arabic segment only.
- I can plan a sprint by dragging tickets, run it on the kanban board, and roll leftovers to the next sprint.
- Every screen uses only design-system tokens and primitives, and the CI checks pass.
- `/team/design` shows every component in light, dark, Arabic and English.
- Drive shows the shared folders and each project's folder, and Finance is hidden from people outside the Finance group.
- On my phone I can approve an expense, mark a ticket done, post my stand-up and reply to an email.
- A new teammate added to the Microsoft group signs in with one click and sees no setup or consent screens.
- `README.md` explains local setup in under ten steps.
