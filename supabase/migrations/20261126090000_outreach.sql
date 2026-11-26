-- Partner outreach: researched organisations, each with why they fit, what Suhail offers them, one first ask, who to
-- write to and a ready email. A row hangs off a relationship, so replies and the history stay in Relationships.
-- Sending goes out from the signed-in person's own Outlook with their signature (lib/outreach.ts).

create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null unique references public.relationships(id) on delete cascade,
  batch text not null default '',                       -- which research pack it came from, e.g. 2026-11
  segment text not null default '',
  priority smallint not null default 2 check (priority between 1 and 3),
  country text not null default '',
  website text,
  why_them text not null default '' check (length(why_them) <= 4000),
  why_us text not null default '' check (length(why_us) <= 4000),
  ask text not null default '' check (length(ask) <= 1000),
  programs text[] not null default '{}',
  sources jsonb not null default '[]',
  contact_name text,
  contact_role text,
  linkedin text,
  email_source text,                                    -- where the address was published; never guessed
  form_url text,
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '' check (length(body) <= 20000),
  status text not null default 'ready' check (status in ('ready','drafted','sent','skipped')),
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index outreach_status_idx on public.outreach (status, priority);

alter table public.outreach enable row level security;
alter table public.outreach force row level security;
create policy team_select on public.outreach for select to authenticated using (public.is_team());
create policy team_insert on public.outreach for insert to authenticated with check (public.is_team());
create policy team_update on public.outreach for update to authenticated using (public.is_team()) with check (public.is_team());
create policy admin_delete on public.outreach for delete to authenticated using (public.is_admin());
create trigger touch_outreach before update on public.outreach for each row execute function public.touch_updated_at();
