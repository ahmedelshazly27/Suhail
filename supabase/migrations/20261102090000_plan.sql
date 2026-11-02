-- The 2027 plan: why, roadmap (milestones and gates), KPIs with targets and values, quarterly reviews, and the
-- Finance income list that revenue is computed from. Team reads; owners and admins edit; KPI owners record their
-- own values; milestone owners update their own milestones; income is Finance only; reviews are append-only.

create table public.plan_years (
  year int primary key check (year between 2020 and 2100),
  theme text not null default '',
  why jsonb not null default '{}',               -- { mission, vision, principles }: Tiptap documents
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  year int not null references public.plan_years(year),
  quarter int not null check (quarter between 1 and 4),
  department text not null,
  title text not null check (length(title) between 1 and 200),
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started','on_track','at_risk','done')),
  project_ids uuid[] not null default '{}',
  ticket_ids uuid[] not null default '{}',
  sort int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index milestones_year_idx on public.milestones (year, quarter, department);

create table public.gates (
  id uuid primary key default gen_random_uuid(),
  year int not null,                             -- 2027 gates sit at the end of a quarter; later ones lead into a year
  after_quarter int check (after_quarter between 1 and 4),
  title text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gate_criteria (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references public.gates(id) on delete cascade,
  text text not null check (length(text) between 1 and 200),
  met boolean not null default false,
  met_at timestamptz,
  met_by uuid references public.profiles(id),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_en text not null, name_ar text not null,
  unit text not null default 'count' check (unit in ('count','percent','usd')),
  source text not null default 'manual' check (source in ('auto','manual')),
  owner_id uuid references public.profiles(id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  year int not null,
  quarter int check (quarter between 1 and 4),   -- null: the yearly target; 1 to 4: that quarter's checkpoint
  target numeric(14,2) not null check (target >= 0),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (kpi_id, year, quarter)
);

create table public.kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  value numeric(14,2) not null check (value >= 0),
  on_date date not null default current_date,
  note text not null default '' check (length(note) <= 500),
  source text not null default 'manual' check (source in ('manual','snapshot')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index kpi_values_kpi_idx on public.kpi_values (kpi_id, on_date desc);
create unique index kpi_values_snapshot_once on public.kpi_values (kpi_id, on_date) where source = 'snapshot';

create table public.income (
  id uuid primary key default gen_random_uuid(),
  received_on date not null default current_date,
  partner text not null check (length(partner) between 1 and 160),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  relationship_id uuid references public.relationships(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create table public.plan_reviews (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  snapshot jsonb not null,                       -- every milestone status and KPI value at that moment
  went_well text not null default '',
  went_badly text not null default '',
  will_change text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid(),
  unique (year, quarter)
);
-- Reviews are kept forever, as they were written.
create or replace function public.plan_reviews_immutable() returns trigger language plpgsql as $$
begin raise exception 'plan reviews are read-only'; end $$;
create trigger plan_reviews_no_change before update or delete on public.plan_reviews for each row execute function public.plan_reviews_immutable();

-- Values are history: corrections are new entries, not edits.
create or replace function public.kpi_values_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception 'kpi values are kept as history; add a new value instead'; end if;
  return old;
end $$;
create trigger kpi_values_no_update before update on public.kpi_values for each row execute function public.kpi_values_immutable();

do $$ declare t text; begin
  foreach t in array array['plan_years','milestones','gates','gate_criteria','kpis','income'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS
do $$ declare t text; begin
  foreach t in array array['plan_years','milestones','gates','gate_criteria','kpis','kpi_targets','kpi_values','income','plan_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Team reads the plan; owners and admins edit it.
do $$ declare t text; begin
  foreach t in array array['plan_years','milestones','gates','gate_criteria','kpis','kpi_targets'] loop
    execute format('create policy team_select on public.%I for select to authenticated using (public.is_team())', t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;
-- A milestone's owner keeps it up to date.
create policy owner_update on public.milestones for update to authenticated
  using (public.is_team() and owner_id = auth.uid()) with check (public.is_team() and owner_id = auth.uid());

-- KPI values: team reads; a manual KPI's owner (or an admin) adds values. Snapshots come from server jobs only.
create policy team_select on public.kpi_values for select to authenticated using (public.is_team());
create policy owner_insert on public.kpi_values for insert to authenticated with check (
  public.is_team() and source = 'manual' and created_by = auth.uid()
  and exists (select 1 from public.kpis k where k.id = kpi_id and k.source = 'manual' and (k.owner_id = auth.uid() or public.is_admin())));
create policy admin_delete on public.kpi_values for delete to authenticated using (public.is_admin());

-- Income: Finance only. Everyone else sees revenue as a KPI total, computed on the server.
create policy finance_select on public.income for select to authenticated using (public.is_finance());
create policy finance_insert on public.income for insert to authenticated with check (public.is_finance() and created_by = auth.uid());
create policy finance_update on public.income for update to authenticated using (public.is_finance()) with check (public.is_finance());
create policy finance_delete on public.income for delete to authenticated using (public.is_finance());

-- Reviews: team reads; owners and admins write one per quarter; nobody changes it afterwards (trigger above).
create policy team_select on public.plan_reviews for select to authenticated using (public.is_team());
create policy admin_insert on public.plan_reviews for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

revoke all on public.plan_years, public.milestones, public.gates, public.gate_criteria, public.kpis, public.kpi_targets,
  public.kpi_values, public.income, public.plan_reviews from anon;

-- ---------------------------------------------------------------- seed (all editable in the dashboard)
insert into public.plan_years (year, theme) values (2027, ''), (2028, ''), (2029, '') on conflict (year) do nothing;

insert into public.milestones (year, quarter, department, title, sort, created_by)
select 2027, q, d, t, s, null from (values
  ('Team', 1, 'Five leads start', 10), ('Team', 2, 'Contributors join each department', 11), ('Team', 3, 'First paid role, if revenue allows', 12), ('Team', 4, 'Year 2 plan agreed', 13),
  ('Partnerships', 1, 'Sponsor deck', 20), ('Partnerships', 1, '2 partners signed', 21), ('Partnerships', 2, '5 partners', 22), ('Partnerships', 2, 'First revenue', 23),
  ('Partnerships', 3, 'Season sponsors', 24), ('Partnerships', 3, 'Recruiting fees live', 25), ('Partnerships', 4, '10 partners', 26), ('Partnerships', 4, '$60k for the year', 27),
  ('Events', 1, 'Online hackathon 1', 30), ('Events', 1, '3 Majlis episodes', 31), ('Events', 2, 'In-person hackathon, city 1', 32), ('Events', 3, 'Suhail Season 2027, late August', 33),
  ('Events', 4, 'In-person hackathon, city 2', 34), ('Events', 4, 'Online hackathon 2', 35),
  ('Editorial', 1, 'Weekly newsletter', 40), ('Editorial', 1, '1,000 subscribers', 41), ('Editorial', 2, '2,500 subscribers', 42), ('Editorial', 2, 'Two social channels', 43),
  ('Editorial', 3, 'Startup stories', 44), ('Editorial', 3, 'Season coverage', 45), ('Editorial', 4, '5,000 subscribers', 46), ('Editorial', 4, 'Year-end issue', 47),
  ('Engineering and Research', 1, 'Site and dashboard live', 50), ('Engineering and Research', 2, 'Dialect benchmark v0 released', 51),
  ('Engineering and Research', 3, 'Benchmark v1 launched at Season', 52), ('Engineering and Research', 4, 'Open dataset, first release', 53),
  ('Finance', 1, 'Year 1 budget', 60), ('Finance', 1, 'Books set up', 61), ('Finance', 2, 'Legal entity registered', 62), ('Finance', 3, 'Paid-role rule applied', 63),
  ('Finance', 4, 'Events break even', 64), ('Finance', 4, 'Year 2 budget', 65)
) as m(d, q, t, s)
where not exists (select 1 from public.milestones where year = 2027);

-- Gates. Each starts with its own wording as the first criterion; owners add more.
with g as (
  insert into public.gates (year, after_quarter, title, sort)
  select * from (values (2027, 1, 'First partners signed', 1), (2027, 2, 'Season funded', 2), (2027, 3, 'Revenue repeats', 3),
                        (2028, null::int, 'Partners renew and Season has run', 4), (2029, null::int, 'Al Freej full and $300k reached', 5)) v(y, q, t, s)
  where not exists (select 1 from public.gates)
  returning id, sort
)
insert into public.gate_criteria (gate_id, text, sort)
select g.id, c.text, c.sort from g join (values
  (1, 'First partners signed', 1), (2, 'Season funded', 1), (3, 'Revenue repeats', 1),
  (4, 'Partners renew', 1), (4, 'Season has run', 2), (5, 'Al Freej full', 1), (5, '$300k reached', 2)
) as c(gs, text, sort) on c.gs = g.sort;

insert into public.kpis (key, name_en, name_ar, unit, source, sort) values
  ('subscribers', 'Newsletter subscribers', 'مشتركين النشرة', 'count', 'auto', 1),
  ('open_rate', 'Newsletter open rate', 'نسبة فتح النشرة', 'percent', 'manual', 2),
  ('hackathon_participants', 'Hackathon participants', 'المشاركين في الهاكاثونات', 'count', 'auto', 3),
  ('cities', 'Cities with in-person events', 'مدن فيها فعاليات حضورية', 'count', 'manual', 4),
  ('season_attendance', 'Suhail Season attendance', 'حضور موسم سهيل', 'count', 'manual', 5),
  ('freej_founders', 'Al Freej founders', 'مؤسّسين الفريج', 'count', 'manual', 6),
  ('talent_pool', 'Talent pool', 'قائمة المواهب', 'count', 'auto', 7),
  ('hires', 'Hires through Suhail', 'التوظيف عن طريق سهيل', 'count', 'manual', 8),
  ('partners', 'Partners', 'الشركاء', 'count', 'auto', 9),
  ('episodes', 'Majlis episodes', 'حلقات المجلس', 'count', 'auto', 10),
  ('research_releases', 'Open research releases', 'إصدارات البحث المفتوحة', 'count', 'manual', 11),
  ('revenue', 'Revenue', 'الإيرادات', 'usd', 'auto', 12),
  ('paid_roles', 'Paid roles', 'الوظائف المدفوعة', 'count', 'manual', 13)
on conflict (key) do nothing;

-- Yearly targets, then 2027 quarterly checkpoints on the straight line (a rate stays flat).
insert into public.kpi_targets (kpi_id, year, quarter, target)
select k.id, t.y, null, t.v from public.kpis k join (values
  ('subscribers', 2027, 5000), ('subscribers', 2028, 20000), ('subscribers', 2029, 50000),
  ('open_rate', 2027, 45),
  ('hackathon_participants', 2027, 800), ('hackathon_participants', 2028, 3000), ('hackathon_participants', 2029, 8000),
  ('cities', 2027, 2), ('cities', 2028, 4), ('cities', 2029, 8),
  ('season_attendance', 2027, 300), ('season_attendance', 2028, 1000), ('season_attendance', 2029, 2500),
  ('freej_founders', 2027, 0), ('freej_founders', 2028, 8), ('freej_founders', 2029, 20),
  ('talent_pool', 2027, 1500), ('talent_pool', 2028, 6000), ('talent_pool', 2029, 15000),
  ('hires', 2027, 5), ('hires', 2028, 40), ('hires', 2029, 120),
  ('partners', 2027, 10), ('partners', 2028, 25), ('partners', 2029, 50),
  ('episodes', 2027, 12),
  ('research_releases', 2027, 3), ('research_releases', 2028, 5), ('research_releases', 2029, 8),
  ('revenue', 2027, 60000), ('revenue', 2028, 300000), ('revenue', 2029, 1000000),
  ('paid_roles', 2027, 1), ('paid_roles', 2028, 3), ('paid_roles', 2029, 10)
) as t(key, y, v) on t.key = k.key
on conflict do nothing;

insert into public.kpi_targets (kpi_id, year, quarter, target)
select t.kpi_id, 2027, q, case when k.unit = 'percent' then t.target else round(t.target * q / 4.0) end
from public.kpi_targets t join public.kpis k on k.id = t.kpi_id cross join generate_series(1, 4) q
where t.year = 2027 and t.quarter is null
on conflict do nothing;
