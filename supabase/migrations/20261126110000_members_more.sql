-- Suhail Members, second pass: photos, opportunities the team shares with members (credits, grants, jobs, events,
-- calls), and "Ask Suhail" requests that members send to the team (an introduction to a partner, help, feedback).

alter table public.members add column photo_path text;

-- Photos are private: only the server reads them, and pages get short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create table public.member_opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('perk','grant','job','event','call')),
  title text not null check (length(title) between 1 and 160),
  org text not null default '' check (length(org) <= 120),
  body text not null default '' check (length(body) <= 3000),
  url text check (length(url) <= 600),
  deadline date,
  location text not null default '' check (length(location) <= 120),
  tags text[] not null default '{}',
  published boolean not null default true,
  source text not null default '',              -- e.g. 'pack:2026-11' for the starter list
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index member_opportunities_live_idx on public.member_opportunities (published, deadline);

create table public.member_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('intro','help','feedback')),
  target text not null default '' check (length(target) <= 200),   -- who or what they want to reach
  body text not null check (length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  answer text not null default '' check (length(answer) <= 4000),
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_requests_open_idx on public.member_requests (status, created_at desc);

do $$ declare t text; begin
  foreach t in array array['member_opportunities','member_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy team_all on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
create policy member_select on public.member_opportunities for select to authenticated using (published and public.is_member());
create policy own_select on public.member_requests for select to authenticated using (member_id = auth.uid());
create policy own_insert on public.member_requests for insert to authenticated
  with check (member_id = auth.uid() and status = 'open' and answer = '' and answered_by is null and public.is_member());
