-- Suhail core schema. RLS is on for every table. Anonymous users get no policies at all:
-- public forms write through server actions with the service role after validation, Turnstile and rate limiting.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------- helpers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- team
create table public.team_roles (
  key text primary key,
  label text not null,
  description text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  name text not null default '',
  job_title text not null default '',
  avatar_url text,
  team_role text not null default 'member' check (team_role in ('owner','admin','member')),
  functions text[] not null default '{}',          -- e.g. {finance} for approvals and the Finance folder
  ms_oid text unique,
  ms_groups text[] not null default '{}',
  lang text not null default 'en' check (lang in ('ar','en')),
  digest_email boolean not null default false,
  standup_enabled boolean not null default true,
  capacity int not null default 8,                  -- points per sprint
  ics_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  onboarded_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who is signed in, as seen by RLS. security definer so policies on profiles don't recurse.
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$
  select team_role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_team() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner','admin'), false)
$$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'owner', false)
$$;
create or replace function public.is_finance() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and active and 'finance' = any(functions))
$$;
revoke execute on function public.my_role(), public.is_team(), public.is_admin(), public.is_owner(), public.is_finance() from anon;

create table public.graph_tokens (           -- service role only; refresh tokens are encrypted by the app (AES-GCM)
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token_enc text not null,
  scope text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (               -- one row
  id boolean primary key default true check (id),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.settings (id, data) values (true, jsonb_build_object(
  'sprint_length_days', 14,
  'retention_not_now_months', 6,
  'standup', jsonb_build_object('enabled', true, 'time', '09:00', 'days', jsonb_build_array(0,1,2,3,4), 'tz', 'Asia/Kuwait'),
  'teams', jsonb_build_object('channel_webhook', false, 'bot', false),
  'm365', jsonb_build_object('mail', true, 'directory', true, 'teams', true, 'drive', true, 'calendar', true, 'todo', false, 'presence', false, 'email_to_ticket', true, 'weekly_digest', true),
  'expense_currency', 'KWD'
));

-- ---------------------------------------------------------------- recruiting
create table public.forms (
  key text primary key,                         -- careers, hack, house, talent, cofounder, company, season, partner, podcast
  name_en text not null, name_ar text not null,
  stages jsonb not null,                        -- ["New","Reviewing",...]
  schema jsonb,                                 -- field schema for non-careers forms
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null, title_ar text not null,
  plain_en text not null, plain_ar text not null,
  pitch_en text not null, pitch_ar text not null,
  do_en text[] not null default '{}', do_ar text[] not null default '{}',
  you_en text[] not null default '{}', you_ar text[] not null default '{}',
  form_schema jsonb not null default '[]',      -- the role's own task fields, between BASICS and CLOSE
  rubric jsonb not null default '[]',           -- [{"key":"ask","en":"Clear ask with a real number"}]
  status text not null default 'open' check (status in ('open','closed')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null, title_ar text not null,
  city_en text not null, city_ar text not null,
  fmt text not null check (fmt in ('online','inperson')),
  scene text not null default 'pattern',
  desc_en text not null default '', desc_ar text not null default '',
  starts_on date,
  published boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  form_key text not null references public.forms(key),
  role_id uuid references public.roles(id),
  hackathon_id uuid references public.hackathons(id),
  stage text not null default 'New',
  assignee_id uuid references public.profiles(id),
  score numeric(3,2),
  answers jsonb not null default '{}',
  email citext not null,
  name text not null default '',
  cv_path text,
  cv_url text,
  lang text not null default 'ar' check (lang in ('ar','en')),
  tags text[] not null default '{}',
  stage_changed_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index applications_email_idx on public.applications (email);
create index applications_form_stage_idx on public.applications (form_key, stage) where deleted_at is null;

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  body jsonb not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.rubric_scores (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) default auth.uid(),
  criterion text not null,
  score int not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, profile_id, criterion)
);

-- ---------------------------------------------------------------- newsletter and email
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  lang text not null default 'ar' check (lang in ('ar','en')),
  sources text[] not null default '{}',
  topics text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','active','unsubscribed','bounced')),
  confirm_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  resend_contact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  number int,
  title text not null default '',
  subject_ar text not null default '', subject_en text not null default '',
  body_ar jsonb, body_en jsonb,
  segment text not null default 'both' check (segment in ('ar','en','both')),
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  broadcast_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.email_templates (
  key text primary key,                         -- received, interview, not_now, offer
  name text not null,
  subject_ar text not null, subject_en text not null,
  body_ar text not null, body_en text not null, -- plain text with {{name}}, {{role}} placeholders
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  template text,
  subject text not null,
  entity_type text, entity_id uuid,
  resend_id text,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index email_log_entity_idx on public.email_log (entity_type, entity_id);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  resend_id text,
  broadcast_id text,
  issue_id uuid references public.newsletter_issues(id) on delete set null,
  type text not null,
  email citext,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_events_issue_idx on public.email_events (issue_id, type);

-- ---------------------------------------------------------------- work
create table public.project_templates (
  key text primary key,
  name text not null,
  items jsonb not null,                         -- [{title, offset_days, role, estimate, group}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  lead_id uuid references public.profiles(id),
  status text not null default 'active' check (status in ('planned','active','paused','done')),
  target_date date,
  description jsonb,
  doc jsonb,
  budget numeric(12,2),
  currency text not null default 'KWD',
  sharepoint_folder_url text,
  template_key text references public.project_templates(key),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned','active','done')),
  capacity jsonb not null default '{}',        -- {profile_id: points}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  attention boolean not null default false,     -- shown in the accent tint
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create sequence public.ticket_number_seq start 100;
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.ticket_number_seq'),
  key text generated always as ('SUH-' || number) stored,
  title text not null,
  description jsonb,
  status text not null default 'todo' check (status in ('backlog','todo','in_progress','in_review','done','cancelled')),
  priority text not null default 'none' check (priority in ('none','low','med','high','urgent')),
  assignee_id uuid references public.profiles(id),
  project_id uuid references public.projects(id) on delete set null,
  sprint_id uuid references public.sprints(id) on delete set null,
  parent_id uuid references public.tickets(id) on delete set null,
  due_on date,
  estimate int,
  labels uuid[] not null default '{}',
  flagged boolean not null default false,
  source text not null default 'app',           -- app, email, standup, template, meeting
  source_ref text,
  sort double precision not null default 0,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index tickets_board_idx on public.tickets (project_id, status) where deleted_at is null;
create index tickets_assignee_idx on public.tickets (assignee_id) where deleted_at is null;
create index tickets_sprint_idx on public.tickets (sprint_id) where deleted_at is null;

create table public.comments (                 -- polymorphic: application, ticket, relationship, project
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('application','ticket','relationship','project','expense','content')),
  entity_id uuid not null,
  body jsonb not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index comments_entity_idx on public.comments (entity_type, entity_id);

create table public.activity (                 -- append-only audit log
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid references public.profiles(id),
  verb text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_entity_idx on public.activity (entity_type, entity_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,                           -- mention, assigned, application, stage, approval, due
  title text not null,
  body text not null default '',
  entity_type text, entity_id uuid,
  href text,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (profile_id, read_at, created_at desc);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  list text not null,                           -- tickets, applications, relationships, ...
  name text not null default 'Default',
  layout text not null default 'table' check (layout in ('table','board','list')),
  filters jsonb not null default '{}',
  group_by text,
  sort jsonb not null default '[]',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, list, name)
);

-- ---------------------------------------------------------------- workspaces
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain citext,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  name text not null,
  email citext,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index contacts_email_idx on public.contacts (email);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation_id uuid references public.organisations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  type text not null default 'Partner',         -- Sponsor, Partner, Venue, Speaker, Podcast guest, Judge
  stage text not null default 'Prospect' check (stage in ('Prospect','Contacted','In talks','Confirmed','Active','Past')),
  owner_id uuid references public.profiles(id),
  next_step text not null default '',
  next_due date,
  project_ids uuid[] not null default '{}',
  value numeric(12,2),
  last_contact_at timestamptz,
  last_contact_via text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.relationship_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  happened_at timestamptz not null default now(),
  what text not null,
  via text not null default '',
  mail_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('linkedin','instagram','x','newsletter','podcast')),
  title text not null,
  status text not null default 'draft' check (status in ('draft','in_review','approved','scheduled','published')),
  publish_on date,
  owner_id uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  project_id uuid references public.projects(id) on delete set null,
  issue_id uuid references public.newsletter_issues(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.expense_categories (
  key text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  description text not null,
  amount numeric(12,3) not null check (amount > 0),
  currency text not null default 'KWD',
  category text references public.expense_categories(key),
  spent_on date not null default current_date,
  receipt_url text,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  approver_id uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.file_links (               -- attachments are links to the drive, never copies
  id uuid primary key default gen_random_uuid(),
  drive_item_id text,
  web_url text not null,
  name text not null,
  kind text not null default 'file',
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index file_links_entity_idx on public.file_links (entity_type, entity_id);
create index file_links_item_idx on public.file_links (drive_item_id);

create table public.mail_links (               -- metadata only, bodies are fetched live from Graph
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  message_id text not null,
  conversation_id text,
  subject text not null default '',
  from_email citext,
  received_at timestamptz,
  web_link text,
  entity_type text,
  entity_id uuid,
  assignee_id uuid references public.profiles(id),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index mail_links_msg_idx on public.mail_links (message_id);

create table public.standups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  sprint_id uuid references public.sprints(id) on delete set null,
  day date not null default current_date,
  done text not null default '',
  next text not null default '',
  blockers text not null default '',
  blocker_ticket_id uuid references public.tickets(id) on delete set null,
  via text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, day)
);

create table public.rate_limits (             -- service role only
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, key_hash, window_start)
);

-- Atomic per-IP counter for public forms. Returns true when the request is allowed.
create or replace function public.hit_rate_limit(p_bucket text, p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); n int;
begin
  insert into public.rate_limits (bucket, key_hash, window_start, count) values (p_bucket, p_key, w, 1)
  on conflict (bucket, key_hash, window_start) do update set count = public.rate_limits.count + 1, updated_at = now()
  returning count into n;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit(text, text, int, int) from anon, authenticated;

-- ---------------------------------------------------------------- updated_at triggers
do $$ declare t text; begin
  for t in select table_name from information_schema.columns where table_schema = 'public' and column_name = 'updated_at' loop
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Activity is append-only, even for the service role through the API.
create or replace function public.activity_immutable() returns trigger language plpgsql as $$
begin raise exception 'activity is append-only'; end $$;
create trigger activity_no_update before update or delete on public.activity for each row execute function public.activity_immutable();

-- ---------------------------------------------------------------- RLS
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Team-readable, team-writable working tables
do $$ declare t text; begin
  foreach t in array array['applications','application_notes','tickets','projects','sprints','labels','comments',
    'organisations','contacts','relationships','relationship_events','content_items','file_links','mail_links',
    'newsletter_issues','subscribers','email_log','email_events','hackathons'] loop
    execute format('create policy team_select on public.%I for select to authenticated using (public.is_team())', t);
    execute format('create policy team_insert on public.%I for insert to authenticated with check (public.is_team())', t);
    execute format('create policy team_update on public.%I for update to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
end $$;
-- Hard deletes only by admins (applications and tickets use soft delete)
do $$ declare t text; begin
  foreach t in array array['application_notes','comments','labels','organisations','contacts','relationships','relationship_events',
    'content_items','file_links','mail_links','newsletter_issues','projects','sprints','hackathons'] loop
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;
-- Authors can delete their own notes, comments and links
create policy own_delete on public.application_notes for delete to authenticated using (created_by = auth.uid());
create policy own_delete on public.comments for delete to authenticated using (created_by = auth.uid());
create policy own_delete on public.file_links for delete to authenticated using (created_by = auth.uid());

-- Settings-type tables: team reads, admins write
do $$ declare t text; begin
  foreach t in array array['settings','forms','roles','email_templates','project_templates','team_roles','expense_categories'] loop
    execute format('create policy team_select on public.%I for select to authenticated using (public.is_team())', t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Profiles: team reads everyone; you edit yourself but not your own role or access; admins edit anyone
create policy team_select on public.profiles for select to authenticated using (public.is_team());
create policy self_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and team_role = public.my_role() and active
    and functions = (select p.functions from public.profiles p where p.id = auth.uid()));
create policy admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Only the owner can create or remove another owner
create or replace function public.guard_owner_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (new.team_role = 'owner' or old.team_role = 'owner') and new.team_role is distinct from old.team_role and not public.is_owner() then
    raise exception 'only an owner can change owner access';
  end if;
  return new;
end $$;
create trigger profiles_owner_guard before update on public.profiles for each row execute function public.guard_owner_role();

-- Rubric scores: team reads all, each person writes their own
create policy team_select on public.rubric_scores for select to authenticated using (public.is_team());
create policy own_insert on public.rubric_scores for insert to authenticated with check (public.is_team() and profile_id = auth.uid());
create policy own_update on public.rubric_scores for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy own_delete on public.rubric_scores for delete to authenticated using (profile_id = auth.uid());

-- Activity: append-only, as yourself
create policy team_select on public.activity for select to authenticated using (public.is_team());
create policy team_insert on public.activity for insert to authenticated with check (public.is_team() and actor_id = auth.uid());

-- Notifications: your own only; teammates can create them for each other
create policy own_select on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy team_insert on public.notifications for insert to authenticated with check (public.is_team());
create policy own_update on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy own_delete on public.notifications for delete to authenticated using (profile_id = auth.uid());

-- Saved views: per user
create policy own_all on public.saved_views for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_team());

-- Stand-ups: team reads, you write your own
create policy team_select on public.standups for select to authenticated using (public.is_team());
create policy own_insert on public.standups for insert to authenticated with check (profile_id = auth.uid() and public.is_team());
create policy own_update on public.standups for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Expenses: team reads and submits their own; edit your own while pending; finance decides
create policy team_select on public.expenses for select to authenticated using (public.is_team());
create policy own_insert on public.expenses for insert to authenticated
  with check (public.is_team() and created_by = auth.uid() and status = 'pending' and approver_id is null);
create policy own_update_pending on public.expenses for update to authenticated
  using (created_by = auth.uid() and status = 'pending')
  with check (created_by = auth.uid() and status = 'pending' and approver_id is null);
create policy finance_update on public.expenses for update to authenticated using (public.is_finance()) with check (public.is_finance());
create policy finance_delete on public.expenses for delete to authenticated using (public.is_finance());

-- graph_tokens and rate_limits: no policies. Only the service role (server code) can touch them.

-- Grants: anon gets nothing. Authenticated goes through RLS.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
revoke all on public.graph_tokens, public.rate_limits from authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cvs', 'cvs', false, 10485760, array['application/pdf']),
  ('receipts', 'receipts', false, 10485760, array['application/pdf','image/jpeg','image/png','image/heic','image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- cvs: no policies, so only the service role can read or write; the dashboard gets 60-second signed URLs from server code.
-- receipts: team members upload their own receipts and read all; finance and admins delete.
create policy receipts_team_read on storage.objects for select to authenticated using (bucket_id = 'receipts' and public.is_team());
create policy receipts_team_write on storage.objects for insert to authenticated with check (bucket_id = 'receipts' and public.is_team() and owner = auth.uid());
create policy receipts_finance_delete on storage.objects for delete to authenticated using (bucket_id = 'receipts' and public.is_finance());
-- avatars: public read via the public bucket URL; team members manage their own folder
create policy avatars_own_write on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and public.is_team() and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- realtime for boards and the inbox
alter publication supabase_realtime add table public.tickets, public.applications, public.notifications, public.comments;
