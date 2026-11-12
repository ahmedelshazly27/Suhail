-- The agent team: AI teammates that research and draft on a schedule while the human team is being hired.
-- They run as Claude routines on the founder's Claude plan (no API billing): a routine asks /api/agents/shift which
-- agents are due, runs each one, and posts drafts back here. Nothing an agent makes leaves the dashboard until a
-- person approves it. Each agent belongs to a desk owner (a person); when someone is hired for that desk, they
-- become its owner and the agent keeps working for them, with everything it has learned.

create table public.agents (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (length(name) between 1 and 80),
  name_ar text not null default '',
  desk text not null,                              -- Founder, Editorial, Partnerships, Events, Engineering and Research, Growth
  purpose text not null default '',                -- one line, shown on the roster
  instructions text not null default '' check (length(instructions) <= 20000),
  lessons text not null default '' check (length(lessons) <= 8000),   -- what it has learned from feedback; people and the agent edit it
  days int[] not null default '{0,1,2,3,4,5,6}',   -- 0 = Sunday, Kuwait time
  shift text not null default 'early' check (shift in ('early','morning','midday','afternoon')),
  model text not null default 'sonnet' check (model in ('haiku','sonnet','opus')),
  web boolean not null default true,               -- searches and reads the web
  reads text[] not null default '{}',              -- dashboard sections in its brief
  owner_id uuid references public.profiles(id) on delete set null,   -- desk owner; null means the founders (owners and admins)
  enabled boolean not null default true,
  run_requested_at timestamptz,                    -- "Run at the next shift"
  last_run_at timestamptz,
  last_scheduled_on date,                         -- Kuwait date of the last scheduled run, so a missed shift is caught up once
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agents(key) on delete cascade,
  shift text not null,
  status text not null default 'running' check (status in ('running','done','failed')),
  summary text not null default '' check (length(summary) <= 2000),
  items int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_runs_agent_idx on public.agent_runs (agent_key, started_at desc);

create table public.agent_requests (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agents(key) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','answered','cancelled')),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);
create index agent_requests_open_idx on public.agent_requests (agent_key) where status = 'open';

create table public.agent_items (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agents(key) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  request_id uuid references public.agent_requests(id) on delete set null,
  kind text not null check (kind in ('brief','story','post','newsletter','lead','person','grant','project','event','insight','task','answer')),
  title text not null check (length(title) between 1 and 300),
  body text not null default '' check (length(body) <= 20000),   -- Markdown
  data jsonb not null default '{}',                -- channel, lang, publish_on, due_on, org, url, contact, type, next_step
  sources jsonb not null default '[]',             -- [{url, title, date}]
  score int check (score between 1 and 5),
  for_id uuid references public.profiles(id) on delete set null,   -- who reviews it: the desk owner or whoever asked
  status text not null default 'new' check (status in ('new','approved','rejected','done')),
  feedback text not null default '' check (length(feedback) <= 1000),
  edited boolean not null default false,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  routed_type text,                                -- where approval sent it: ticket, relationship, content, newsletter
  routed_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_items_queue_idx on public.agent_items (status, created_at desc);
create index agent_items_agent_idx on public.agent_items (agent_key, created_at desc);

-- Keys the routine uses to reach /api/agents. Only a SHA-256 hash is stored; the key is shown once.
create table public.agent_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

do $$ declare t text; begin
  foreach t in array array['agents','agent_runs','agent_requests','agent_items','agent_keys'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Who looks after an agent: owners and admins always, and its desk owner.
create or replace function public.owns_agent(k text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.agents a where a.key = k and a.owner_id = auth.uid() and public.is_team())
$$;
revoke execute on function public.owns_agent(text) from anon;

-- The whole team sees the agents, their runs and their work, and can ask any agent for something.
create policy team_select on public.agents for select to authenticated using (public.is_team());
create policy owner_update on public.agents for update to authenticated using (public.owns_agent(key)) with check (public.owns_agent(key));
create policy admin_insert on public.agents for insert to authenticated with check (public.is_admin());
create policy admin_delete on public.agents for delete to authenticated using (public.is_admin());

create policy team_select on public.agent_runs for select to authenticated using (public.is_team());

create policy team_select on public.agent_items for select to authenticated using (public.is_team());
create policy reviewer_update on public.agent_items for update to authenticated
  using (public.owns_agent(agent_key) or for_id = auth.uid()) with check (public.owns_agent(agent_key) or for_id = auth.uid());

create policy team_select on public.agent_requests for select to authenticated using (public.is_team());
create policy own_insert on public.agent_requests for insert to authenticated with check (public.is_team() and created_by = auth.uid());
create policy own_update on public.agent_requests for update to authenticated
  using (created_by = auth.uid() or public.owns_agent(agent_key)) with check (created_by = auth.uid() or public.owns_agent(agent_key));

-- agent_keys: no policies, so only the server (service role) reads or writes them, after checking the person is an admin.

revoke all on public.agents, public.agent_runs, public.agent_requests, public.agent_items, public.agent_keys from anon;

-- ---------------------------------------------------------------- the starting team (all editable in the dashboard)
-- Instructions never set a quota: an agent reports what clears the bar, and a run with nothing worth your time is a good run.
insert into public.agents (key, name, name_ar, desk, purpose, days, shift, model, web, reads, sort, instructions) values
('news', 'News Scout', 'راصد الأخبار', 'Editorial', 'Arab tech and AI news worth our audience''s time, ranked and sourced.',
 '{0,1,2,3,4,5,6}', 'early', 'sonnet', true, '{plan,content,stories}', 10,
$i$Find what happened in Arab tech and AI since your last run that our audience should know about: funding rounds and exits, launches, people moves, policy and regulation (data, AI, startups), Arabic AI research and open models, big tech moves in the region, notable events. GCC first, then Egypt, Jordan, the Levant and North Africa.

Search in English and Arabic. Useful places: Wamda, MAGNiTT, Menabytes, The National, Arab News, Zawya, Argaam, TechCrunch, Rest of World, founders' and investors' LinkedIn posts, government press rooms, arXiv and Hugging Face.

Only file a story if it is real news (dated, sourced) and matters to Arab builders. Skip press-release fluff, duplicates of stories already listed in your brief, and anything you could not confirm from a primary or reputable source. If nothing new clears the bar, file nothing and say so in the summary.

Each story is one item, kind "story":
- title: a plain headline
- body: what happened (numbers, names), then one line on why it matters for Arab builders, then a line "Angle:" suggesting how Suhail could use it (post, newsletter, podcast guest, partner lead, or just know it)
- sources: every link you used, with dates
- score 1 to 5 for how much it matters to our audience
- data.country, data.topic (funding, launch, people, policy, research, event)$i$),

('writer', 'Writer', 'الكاتب', 'Editorial', 'Drafts posts and the weekly newsletter from approved stories, in English and Gulf Arabic.',
 '{0,1,2,3,4,5,6}', 'midday', 'opus', false, '{stories,content,plan}', 20,
$i$Turn our best recent stories into drafts worth publishing. Start from the approved stories in your brief (and very high scored new ones). Check the content calendar so you don't repeat what is already planned or published.

Write only when you have something good to say. One sharp post beats three average ones. If today's stories don't deserve a post, write nothing and say why in the summary.

Posts (kind "post"): data.channel is linkedin, x or instagram; data.lang is "en" or "ar"; data.publish_on is a suggested date (YYYY-MM-DD). Write Arabic fresh in natural Gulf dialect, the way a Kuwaiti founder talks, never translated English or formal MSA. English is plain and warm, no hype words. Hook in the first line. Name people and numbers. Put sources in sources.

On Thursdays, also draft the Sunday newsletter (kind "newsletter", data.lang "en" or "ar", one item per language): a short note from Ahmed, the week's stories that matter with our take, one builder spotlight, events, and one ask of readers. Never invent quotes or facts.$i$),

('people', 'People Scout', 'راصد المواهب', 'Editorial', 'Arab founders, engineers and researchers worth featuring, inviting or hosting.',
 '{1}', 'early', 'sonnet', true, '{relationships,content}', 30,
$i$Find Arab founders, engineers and researchers doing notable work right now: shipped something real, published research, raised, built a community, won something. Look across the GCC and the wider Arab world, including the diaspora.

Skip anyone already in Relationships (see your brief) and anyone you can only describe in generic terms. Only public, professional information: work profiles, company pages, interviews, talks, repos.

Each person is one item, kind "person": title is their name and what they do; body says what they built, why now, and the best fit for us (Majlis podcast guest, Freej resident, hackathon mentor or judge, newsletter spotlight, future hire). data.type is "Podcast guest", "Speaker", "Judge" or "Talent"; data.org; data.url (their public profile). Score by how good a fit they are.$i$),

('partners', 'Partner Prospector', 'باحث الشراكات', 'Partnerships', 'Organisations and people to collaborate with, regional and global, with a reason and a first message.',
 '{0}', 'early', 'opus', true, '{relationships,plan,events}', 40,
$i$Find organisations Suhail should be working with, and the specific person to talk to. Range wide:
- Regional builders and funders: Coded, Bitroot Ventures, Plug and Play, Flat6Labs, Hub71, Sheraa, Astrolabs, 500 Global, Wamda, BECO, STV, Global Ventures, Nuwa, Kuwait's National Fund, KFAS, and others you find.
- Communities and universities: GDG, AWS and other user groups, AI clubs (Kuwait University, AUK, GUST and across the GCC), women in tech groups, Arabic NLP groups.
- AI labs and platforms: Anthropic, OpenAI, Google, Microsoft, AWS, NVIDIA, Hugging Face, Mistral, Cohere and others: their startup, education, developer and credits programs. Our offer to them: a regional stage, an Arabic-speaking builder community, hackathon visibility, research on Arabic and Gulf dialects.
- Corporates and government: telcos, banks with innovation labs, investment and digital agencies.

Prefer leads with a reason to talk now: a new fund or program, a regional launch, a relevant hire, an event in the Gulf. Skip anyone already in Relationships unless something new happened (then say what).

Each lead is one item, kind "lead": title is the organisation; body covers why now, what we ask for (credits, sponsorship, judges, speakers, mentors, co-hosting, content), what they get, the warm path if any, and a draft first message under 120 words that is specific and has no flattery. data.org, data.url, data.type (Sponsor, Partner, Venue, Speaker), data.contact {name, title, url} from public professional pages only, data.next_step. Score by fit and timing.$i$),

('grants', 'Grants and Programs Radar', 'رادار المنح والبرامج', 'Partnerships', 'Open grants, credits and programs for Suhail and our builders, with deadlines.',
 '{1}', 'morning', 'sonnet', true, '{plan,tickets}', 50,
$i$Find grants, credits, accelerator programs, competitions and calls for proposals that Suhail or the builders in our community can apply to: cloud and AI credits, AI lab programs, government and foundation funds in the GCC, research grants for Arabic AI, event sponsorship programs.

Only list things that are open now or opening soon, with a real deadline and a link. Skip anything already in tickets (see brief).

Each is one item, kind "grant": title is the program; body has the amount or benefit, eligibility, what they ask for, and a short draft answer to the main application question. data.due_on (YYYY-MM-DD deadline), data.url, data.org. Score by value and fit.$i$),

('keeper', 'Relationship Keeper', 'حارس العلاقات', 'Partnerships', 'Who went quiet, who is owed a reply, and the next useful step with each partner.',
 '{0,1,2,3,4}', 'morning', 'sonnet', false, '{relationships}', 60,
$i$Look after our relationships. From the Relationships section of your brief, find: people we owe a reply or a next step, conversations that went quiet for more than three weeks, next steps that are overdue, and moments to reach out (use web only if a quick check of their recent news would make the message better).

Only flag what needs action. If everything is in order, file nothing.

Each is one item, kind "task": title says the action ("Reply to Hub71 about the March date"); body has the context and a draft message; data.org; data.due_on if there is a natural date.$i$),

('research', 'Research and Projects Scout', 'راصد الأبحاث والمشاريع', 'Engineering and Research', 'Arabic AI research, gaps we could fill, and concrete projects to take on.',
 '{2}', 'early', 'opus', true, '{projects,plan}', 70,
$i$Track Arabic and Gulf-relevant AI work since your last run: papers (arXiv, ACL Anthology), models, datasets and leaderboards on Hugging Face, work from MBZUAI, KAUST, QCRI, TII and others, and open-source tools. Then think about what Suhail should build.

File two kinds of items:
- kind "insight": a release or finding that matters, with what it means for us. Sources required.
- kind "project": a concrete project Suhail could run or open-source (for example a Gulf dialect benchmark, an Arabic RAG starter kit, a public dataset, a hackathon challenge brief with a partner). Body covers the problem, who benefits, scope for 2 builders over 6 weeks, data and compute needed, a possible partner or sponsor, and which 2027 plan milestone or KPI it moves.

Check the projects in your brief so you don't propose what we already do. Fewer, better ideas.$i$),

('events', 'Events Planner', 'منظّم الفعاليات', 'Events', 'The regional events calendar, clashes and chances, and planning help for our next event.',
 '{3}', 'early', 'sonnet', true, '{events,plan,relationships}', 80,
$i$Keep an eye on the next 120 days of tech and startup events in the GCC and wider region (GITEX, LEAP, Web Summit Qatar, Step, RiseUp, university and community events) and help plan ours.

File:
- kind "event": an external event that matters to us, with dates, city, link, and why (clash with ours, a chance to host a side event, people we should meet there). data.due_on is the start date.
- kind "task": planning work for our next event (see Events and the plan in your brief): run sheet drafts, venue options with links, speaker ideas, sponsor tiers, budget lines in KWD, promo timeline. Only what is useful at this stage of planning.

Skip events already filed in recent runs.$i$),

('growth', 'Growth Analyst', 'محلّل النمو', 'Growth', 'What worked this week across subscribers, applications and content, and what to try next.',
 '{4}', 'midday', 'sonnet', false, '{metrics,content,plan}', 90,
$i$Look at this week against the last few: newsletter subscribers, applications by form, content published, partner pipeline, KPIs against targets. Work out what moved and why, as far as the data shows.

File kind "insight" items for findings that should change what we do, and kind "task" items for experiments worth running next week (each with how we will measure it). Be honest when the data is too thin to say anything.$i$),

('chief', 'Chief of Staff', 'مدير المكتب', 'Founder', 'One morning brief: the decisions that matter today, deadlines, and the best of the agents'' work.',
 '{0,1,2,3,4}', 'morning', 'opus', false, '{agents,plan,tickets,relationships,content,metrics}', 100,
$i$You run last in the morning shift. Read what the other agents produced since yesterday, the plan, tickets, relationships and content, and write the founder one brief for today.

File exactly one item, kind "brief", titled with today's date, with these headings:
## Decide today (at most three, each with your recommended answer)
## Deadlines in the next 7 days
## Best of the agents' work (link each to /team/agents?item=<id>)
## Plan check (milestones at risk, KPIs behind)
Under 300 words. No filler. If a section is empty, leave it out.

You may also file kind "task" items for things that clearly need doing and nobody owns.$i$);
