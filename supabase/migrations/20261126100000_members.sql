-- Suhail Members: an invite-only app for the people who build, fund and hire. Members sign in by email link; they
-- never get a team profile, so is_team() stays false for them and nothing in the dashboard is visible to them.
-- Every member can invite a few people; anyone else applies and the team decides.

create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  headline text not null default '' check (length(headline) <= 160),        -- "ML engineer at Careem"
  building text not null default '' check (length(building) <= 1200),      -- what they're building now
  role text not null default 'Engineer' check (role in ('Engineer','Founder','Researcher','Designer','Product','Investor','Operator','Student')),
  company text not null default '' check (length(company) <= 120),
  city text not null default '' check (length(city) <= 80),
  country text not null default '' check (length(country) <= 80),
  skills text[] not null default '{}',
  looking_for text[] not null default '{}',   -- cofounder, hiring, job, funding, collaborators, mentor, mentee
  open_to_intros boolean not null default true,
  links jsonb not null default '{}',          -- linkedin, x, github, site
  avatar_url text,
  lang text not null default 'ar' check (lang in ('ar','en')),
  status text not null default 'active' check (status in ('active','paused','removed')),
  invited_by uuid references public.members(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and status = 'active')
$$;

create index members_joined_idx on public.members (joined_at desc) where status = 'active';

-- The address stays out of the directory: only its owner (and the server, for introductions) reads it.
create table public.member_private (
  id uuid primary key references public.members(id) on delete cascade,
  email citext not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_invites (
  code text primary key check (code ~ '^[a-z0-9]{8,16}$'),
  email citext,                                   -- set when the invite is for one person
  note text not null default '' check (length(note) <= 300),
  created_by_member uuid references public.members(id) on delete cascade,
  created_by_team uuid references public.profiles(id) on delete set null,
  used_by uuid references public.members(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email citext not null,
  role text not null default 'Engineer',
  building text not null check (length(building) between 1 and 1500),
  link text check (length(link) <= 500),
  city text not null default '' check (length(city) <= 80),
  status text not null default 'new' check (status in ('new','invited','declined')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  lang text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_applications_status_idx on public.member_applications (status, created_at desc);

create table public.member_trips (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  city text not null check (length(city) between 1 and 80),
  country text not null default '' check (length(country) <= 80),
  starts_on date not null,
  ends_on date not null,
  note text not null default '' check (length(note) <= 200),
  check (ends_on >= starts_on and ends_on - starts_on <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_trips_dates_idx on public.member_trips (ends_on);

create table public.member_posts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('shipped','ask','discussion','meetup')),
  title text not null check (length(title) between 1 and 160),
  body text not null default '' check (length(body) <= 6000),
  link text check (length(link) <= 500),
  city text not null default '' check (length(city) <= 80),
  happens_at timestamptz,                         -- meetups
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_posts_new_idx on public.member_posts (created_at desc) where deleted_at is null;

create table public.member_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.member_posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_comments_post_idx on public.member_comments (post_id, created_at);

create table public.member_reactions (
  post_id uuid not null references public.member_posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

create table public.member_rsvps (
  post_id uuid not null references public.member_posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

-- Introductions are double opt-in: the other person accepts before either address is shared.
create table public.member_intros (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.members(id) on delete cascade,
  to_id uuid not null references public.members(id) on delete cascade,
  note text not null check (length(note) between 1 and 1000),
  via text not null default 'member' check (via in ('member','team')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create unique index member_intros_pair_idx on public.member_intros (from_id, to_id) where status = 'pending';

do $$ declare t text; begin
  foreach t in array array['members','member_private','member_invites','member_applications','member_trips','member_posts','member_comments','member_reactions','member_rsvps','member_intros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- The team sees and manages everything (moderation, applications, invites).
    execute format('create policy team_all on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
  foreach t in array array['members','member_private','member_invites','member_applications','member_trips','member_posts','member_comments','member_intros'] loop
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Members: active members see each other; you edit only yourself.
create policy member_select on public.members for select to authenticated using (id = auth.uid() or (public.is_member() and status = 'active'));
create policy member_update on public.members for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_select on public.member_private for select to authenticated using (id = auth.uid());
create policy own_select on public.member_invites for select to authenticated using (created_by_member = auth.uid());

create policy member_select on public.member_trips for select to authenticated using (public.is_member());
create policy own_write on public.member_trips for all to authenticated using (member_id = auth.uid() and public.is_member()) with check (member_id = auth.uid() and public.is_member());

create policy member_select on public.member_posts for select to authenticated using (public.is_member() and deleted_at is null);
create policy own_insert on public.member_posts for insert to authenticated with check (member_id = auth.uid() and public.is_member());
create policy own_update on public.member_posts for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy member_select on public.member_comments for select to authenticated using (public.is_member());
create policy own_insert on public.member_comments for insert to authenticated with check (member_id = auth.uid() and public.is_member());
create policy own_delete on public.member_comments for delete to authenticated using (member_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['member_reactions','member_rsvps'] loop
    execute format('create policy member_select on public.%I for select to authenticated using (public.is_member())', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (member_id = auth.uid() and public.is_member())', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (member_id = auth.uid())', t);
  end loop;
end $$;

create policy party_select on public.member_intros for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy own_insert on public.member_intros for insert to authenticated with check (from_id = auth.uid() and via = 'member' and status = 'pending' and public.is_member());
create policy to_update on public.member_intros for update to authenticated using (to_id = auth.uid() and status = 'pending') with check (to_id = auth.uid());

-- A member can't change their own standing or who invited them; only the team (or the server) can.
create or replace function public.members_guard() returns trigger language plpgsql as $$
begin
  if not public.is_team() and coalesce(auth.role(), '') <> 'service_role'
     and (new.status is distinct from old.status or new.invited_by is distinct from old.invited_by or new.joined_at is distinct from old.joined_at) then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create trigger members_guard before update on public.members for each row execute function public.members_guard();
-- An introduction's parties and note are fixed once sent; the recipient only decides.
create or replace function public.intros_guard() returns trigger language plpgsql as $$
begin
  if not public.is_team() and coalesce(auth.role(), '') <> 'service_role'
     and (new.from_id is distinct from old.from_id or new.to_id is distinct from old.to_id or new.note is distinct from old.note or new.via is distinct from old.via) then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create trigger intros_guard before update on public.member_intros for each row execute function public.intros_guard();

revoke execute on function public.is_member() from anon, public;
grant execute on function public.is_member() to authenticated, service_role;
