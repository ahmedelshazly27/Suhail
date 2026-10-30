-- Demo data for the LOCAL stack only (screenshots against the mockups, e2e tests). Never run on staging or production.
-- Mirrors the people and records in reference/dashboard-mockup. Run after the owner has signed in once.
do $$
declare
  owner uuid := (select id from public.profiles where email = 'a.elshazly@suhail.build');
  sara uuid := '00000000-0000-4000-8000-0000000000a1'; layla uuid := '00000000-0000-4000-8000-0000000000a2';
  yousef uuid := '00000000-0000-4000-8000-0000000000a3'; fin uuid := '00000000-0000-4000-8000-0000000000a4';
  hk uuid; mj uuid; bm uuid; nl uuid; web uuid; s4 uuid; t142 uuid; partnerships uuid; events uuid; editorial uuid; engineering uuid; financer uuid;
  d date := (now() at time zone 'Asia/Kuwait')::date;
begin
  if owner is null then raise exception 'sign in as the owner first'; end if;
  if exists (select 1 from public.projects where slug = 'hackathon-kuwait') then return; end if;
  update public.profiles set name = 'Ahmed El Shazly', job_title = 'Founder', capacity = 10, onboarded_at = coalesce(onboarded_at, now()) where id = owner;

  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at) values
    (sara, 'sara@suhail.build', 'authenticated', 'authenticated', now(), now(), now()), (layla, 'layla@suhail.build', 'authenticated', 'authenticated', now(), now(), now()),
    (yousef, 'yousef@suhail.build', 'authenticated', 'authenticated', now(), now(), now()), (fin, 'finance@suhail.build', 'authenticated', 'authenticated', now(), now(), now())
  on conflict do nothing;
  insert into public.profiles (id, email, name, job_title, team_role, functions, onboarded_at) values
    (sara, 'sara@suhail.build', 'Sara', 'Head of Partnerships', 'admin', '{partnerships}', now()), (layla, 'layla@suhail.build', 'Layla', 'Head of Editorial', 'member', '{editorial}', now()),
    (yousef, 'yousef@suhail.build', 'Yousef', 'Head of Engineering', 'member', '{engineering}', now()), (fin, 'finance@suhail.build', 'Finance', 'Finance Lead', 'member', '{finance}', now())
  on conflict do nothing;

  insert into public.projects (slug, name, lead_id, status, target_date, budget, sort, template_key) values ('hackathon-kuwait', 'Hackathon Kuwait', sara, 'active', d + 15, 4000, 1, 'hackathon') returning id into hk;
  insert into public.projects (slug, name, lead_id, status, target_date, budget, sort) values ('the-majlis-season-1', 'The Majlis, season 1', layla, 'active', d + 60, 800, 2) returning id into mj;
  insert into public.projects (slug, name, lead_id, status, target_date, budget, sort) values ('arabic-benchmark-v0', 'Arabic benchmark v0', yousef, 'active', d + 40, 1500, 3) returning id into bm;
  insert into public.projects (slug, name, lead_id, status, sort) values ('newsletter', 'Newsletter', layla, 'active', 4) returning id into nl;
  insert into public.projects (slug, name, lead_id, status, sort) values ('website', 'Website', owner, 'planned', 5) returning id into web;

  insert into public.sprints (number, starts_on, ends_on, status, capacity) values (3, d - 19, d - 6, 'done', '{}'), (4, d - 5, d + 8, 'active', '{}'), (5, d + 9, d + 22, 'planned', '{}');
  select id into s4 from public.sprints where number = 4;

  insert into public.tickets (number, title, status, priority, assignee_id, project_id, sprint_id, due_on, estimate, labels, description, created_by) values
    (142, 'Confirm venue for Hackathon Kuwait', 'in_progress', 'high', owner, hk, s4, d, 3, array[(select id from public.labels where name='Logistics')],
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hold the main hall for 14 and 15 November. Deposit is KWD 600 within seven days. Check power for 250 laptops and the stage setup for the opening."}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Get floor plan"}]}]},{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Compare two backup venues"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Walkthrough with Sara"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Pay deposit (expense sent to Finance)"}]}]}]}]}'::jsonb, owner),
    (151, 'Sponsor deck v2 with tier pricing', 'todo', 'high', owner, hk, s4, d + 1, 3, array[(select id from public.labels where name='Sponsors')], null, sara),
    (155, 'Judges shortlist, 8 names', 'todo', 'med', layla, hk, s4, d + 4, 2, array[(select id from public.labels where name='Programme')], null, owner),
    (171, 'Catering quote', 'todo', 'low', sara, hk, s4, d + 5, 1, array[(select id from public.labels where name='Logistics')], null, sara),
    (149, 'Challenge tracks and briefs', 'in_progress', 'med', yousef, hk, s4, d + 3, 5, array[(select id from public.labels where name='Programme')], null, owner),
    (147, 'Registration form copy, AR and EN', 'in_review', 'med', layla, hk, s4, d - 1 + 1, 2, array[(select id from public.labels where name='Comms')], null, owner),
    (150, 'Prize structure and rules', 'in_review', 'med', sara, hk, s4, d + 1, 2, array[(select id from public.labels where name='Programme')], null, owner),
    (139, 'Pick date and city', 'done', 'med', owner, hk, s4, null, 1, array[(select id from public.labels where name='Planning')], null, owner),
    (140, 'Budget draft', 'done', 'med', fin, hk, s4, null, 2, array[(select id from public.labels where name='Finance')], null, owner),
    (144, 'Call for builders post', 'done', 'med', layla, hk, s4, null, 1, array[(select id from public.labels where name='Comms')], null, owner),
    (118, 'Final edit, Majlis episode 3', 'in_review', 'med', owner, mj, s4, d + 2, 3, '{}', null, layla),
    (160, 'Outline newsletter issue 2', 'todo', 'med', owner, nl, s4, d + 3, 2, '{}', null, layla),
    (163, 'Reply to university partnership email', 'todo', 'low', owner, null, null, d + 4, 1, '{}', null, owner),
    (172, 'Mentor briefing pack', 'backlog', 'high', null, hk, null, null, 3, '{}', null, owner),
    (173, 'Day-of run sheet', 'backlog', 'high', null, hk, null, null, 3, '{}', null, owner),
    (174, 'Majlis episode 4 show notes', 'backlog', 'med', null, mj, null, null, 2, '{}', null, owner),
    (175, 'Benchmark: dialect coverage report', 'backlog', 'med', null, bm, null, null, 5, '{}', null, owner),
    (176, 'Newsletter issue 2, Arabic draft', 'backlog', 'med', null, nl, null, null, 2, '{}', null, owner),
    (177, 'Partner page update with first sponsors', 'backlog', 'low', null, web, null, null, 1, '{}', null, owner),
    (178, 'Photographer for the hackathon', 'backlog', 'low', null, hk, null, null, 1, '{}', null, owner),
    (179, 'Model card template', 'backlog', 'low', null, bm, null, null, 2, '{}', null, owner);
  perform setval('public.ticket_number_seq', 180);
  select id into t142 from public.tickets where number = 142;

  insert into public.comments (entity_type, entity_id, body, mentions, created_by, created_at) values
    ('ticket', t142, ('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"' || owner || '","label":"Ahmed"}},{"type":"text","text":" can we move the walkthrough to Sunday? The hall is booked Saturday."}]}]}')::jsonb, array[owner], sara, now() - interval '20 minutes');
  insert into public.activity (entity_type, entity_id, actor_id, verb, data, created_at) values
    ('ticket', t142, owner, 'created', '{"title":"Confirm venue for Hackathon Kuwait"}', now() - interval '5 days'),
    ('ticket', t142, owner, 'changed', '{"field":"status","from":"todo","to":"in_progress"}', now() - interval '2 days');
  insert into public.notifications (profile_id, kind, title, body, entity_type, entity_id, href, created_at) values
    (owner, 'mention', 'Sara on SUH-142', '@Ahmed can we move the venue walkthrough to Sunday? The hall is booked Saturday.', 'ticket', t142, '/team/tickets/SUH-142', now() - interval '20 minutes'),
    (owner, 'mention', 'Layla requested your review', 'LinkedIn post: Hackathon Kuwait call for builders', 'content', null, '/team/content', now() - interval '1 hour');
  insert into public.standups (profile_id, day, sprint_id, done, next) values
    (sara, d, s4, 'Sponsor follow-ups', 'Venue walkthrough'), (layla, d, s4, 'Episode 3 edit', 'Judges list'), (yousef, d, s4, 'Tracks draft', 'Briefs'), (fin, d, s4, 'Budget', 'Deposit');

  insert into public.organisations (name) values ('[Sponsor company]'), ('[Venue]'), ('[University]'), ('[Cloud provider]'), ('[Research lab]'), ('[Investor]'), ('[Media outlet]');
  insert into public.relationships (name, organisation_id, type, stage, owner_id, next_step, next_due, project_ids, last_contact_at, last_contact_via) values
    ('[Sponsor company]', (select id from public.organisations where name='[Sponsor company]'), 'Sponsor', 'In talks', sara, 'Send venue and attendance', d + 7, array[hk], now(), 'Email'),
    ('[Venue]', (select id from public.organisations where name='[Venue]'), 'Venue', 'Confirmed', owner, 'Pay deposit', d, array[hk], now() - interval '3 days', 'Email'),
    ('[University]', (select id from public.organisations where name='[University]'), 'Partner', 'Prospect', null, 'Reply about student teams', d + 1, array[hk], now(), 'Email'),
    ('[Cloud provider]', (select id from public.organisations where name='[Cloud provider]'), 'Sponsor', 'Contacted', sara, 'Follow up on credits', d - 2, array[hk], now() - interval '12 days', 'Email'),
    ('[Founder, Riyadh]', null, 'Podcast guest', 'Contacted', layla, 'Book recording slot', d + 9, array[mj], now() - interval '2 days', 'Teams call'),
    ('[Research lab]', (select id from public.organisations where name='[Research lab]'), 'Partner', 'In talks', yousef, 'Data sharing terms', d + 13, array[bm], now() - interval '6 days', 'Email'),
    ('[Investor]', (select id from public.organisations where name='[Investor]'), 'Judge', 'Confirmed', owner, 'Send judging brief', d + 11, array[hk], now() - interval '1 day', 'Email'),
    ('[Media outlet]', (select id from public.organisations where name='[Media outlet]'), 'Partner', 'Prospect', layla, 'Pitch coverage', d - 1, array[hk], null, null);
  insert into public.relationship_events (relationship_id, happened_at, what, via) values
    ((select id from public.relationships where name='[Sponsor company]'), now(), 'Noura: interested in Gold, two conditions', 'Email to partners@ · linked automatically'),
    ((select id from public.relationships where name='[Sponsor company]'), now() - interval '6 days', 'Sent sponsor deck v1', 'Email from Sara'),
    ((select id from public.relationships where name='[Sponsor company]'), now() - interval '9 days', 'Intro call, 30 min', 'Teams meeting · notes in Docs'),
    ((select id from public.relationships where name='[Sponsor company]'), now() - interval '12 days', 'First contact', 'Email from Sara');

  insert into public.content_items (channel, title, status, publish_on, owner_id, reviewer_id, project_id) values
    ('linkedin', 'Why we are building Suhail', 'published', d - 3, layla, owner, null), ('newsletter', 'Issue 2: who is building in the Gulf', 'in_review', d + 5, layla, owner, nl),
    ('instagram', 'Majlis ep. 3 clip', 'approved', d + 6, layla, null, mj), ('podcast', 'Majlis episode 3', 'scheduled', d + 8, layla, null, mj),
    ('linkedin', 'Call for builders, last week', 'in_review', d + 10, layla, owner, hk), ('x', 'Judges announced', 'draft', d + 11, sara, null, hk),
    ('instagram', 'Venue reveal', 'draft', d + 13, layla, null, hk), ('linkedin', 'Hackathon day 1 live', 'draft', d + 15, layla, null, hk),
    ('x', 'Winners thread', 'draft', d + 16, sara, null, hk), ('newsletter', 'Issue 3: hackathon recap', 'draft', d + 19, layla, null, nl);

  insert into public.expenses (project_id, ticket_id, description, amount, currency, category, spent_on, receipt_url, status, created_by, approver_id, decided_at) values
    (hk, t142, 'Venue deposit, main hall', 600, 'KWD', 'venue', d, 'invoice.pdf', 'pending', owner, null, null),
    (mj, null, 'Studio hire, episode 4', 160, 'KWD', 'equipment', d - 1, 'receipt.jpg', 'pending', layla, null, null),
    (hk, null, 'Printed banners', 85, 'KWD', 'printing', d - 2, 'receipt.pdf', 'pending', sara, null, null),
    (null, null, 'Microsoft 365 Business Basic', 45, 'KWD', 'software', d - 6, 'invoice.pdf', 'paid', owner, fin, now() - interval '5 days'),
    (mj, null, 'Microphones, two', 120, 'KWD', 'equipment', d - 8, 'receipt.pdf', 'approved', layla, fin, now() - interval '7 days'),
    (hk, null, 'Dinner with sponsors', 70, 'KWD', 'catering', d - 11, null, 'rejected', sara, fin, now() - interval '10 days');

  select id into partnerships from public.roles where slug = 'partnerships'; select id into events from public.roles where slug = 'events';
  select id into editorial from public.roles where slug = 'editorial'; select id into engineering from public.roles where slug = 'engineering'; select id into financer from public.roles where slug = 'finance';
  insert into public.applications (form_key, role_id, stage, email, name, lang, answers, cv_url, created_at, stage_changed_at, assignee_id) values
    ('careers', engineering, 'New', 'hassan@example.com', 'Hassan A.', 'en', '{"name":"Hassan A.","email":"hassan@example.com","country":"Egypt","best":"Trained a dialect ASR model that beat Whisper on Egyptian Arabic by 9 points WER.","g_plan":"Fine-tune an open 7B model on Gulf dialect instruction data built from public podcasts with consent.","g_number":"WER 18.2 on our held-out Egyptian set.","g_profiles":"https://github.com/example","hours":"5-10"}', 'https://example.com/cv-hassan.pdf', now() - interval '3 hours', now() - interval '3 hours', null),
    ('careers', editorial, 'New', 'rana@example.com', 'Rana F.', 'ar', '{"name":"Rana F.","email":"rana@example.com","country":"Jordan","best":"أطلقت نشرة عن الشركات الناشئة في الأردن وصلت ٤ آلاف مشترك.","w_open":"افتتاحية عن جولة تمويل في عمّان.","hours":"5-10"}', null, now() - interval '1 day', now() - interval '1 day', null),
    ('careers', events, 'New', 'omar@example.com', 'Omar S.', 'en', '{"name":"Omar S.","email":"omar@example.com","country":"United Arab Emirates","best":"Ran a 300 person hackathon in Dubai with four sponsors.","hours":"10+"}', null, now() - interval '1 day', now() - interval '1 day', null),
    ('careers', financer, 'Reviewing', 'nada@example.com', 'Nada B.', 'en', '{"name":"Nada B.","email":"nada@example.com","country":"Kuwait","best":"Set up the books and banking for a seed-stage fintech in Kuwait.","hours":"5-10"}', null, now() - interval '2 days', now() - interval '1 day', owner),
    ('careers', engineering, 'Reviewing', 'karim@example.com', 'Karim T.', 'en', '{"name":"Karim T.","email":"karim@example.com","country":"Morocco","best":"Built a Darija sentiment dataset of 40k labelled tweets.","hours":"lt5"}', null, now() - interval '4 days', now() - interval '2 days', yousef),
    ('careers', partnerships, 'Task review', 'mariam@example.com', 'Mariam K.', 'en', '{"name":"Mariam K.","email":"mariam@example.com","country":"Saudi Arabia","link":"linkedin.com/in/example","best":"Closed a three-year university partnership worth SAR 400k for a Riyadh accelerator.","p_pitch":"To the Head of Developer Relations at a regional cloud provider: we are asking for SAR 50,000 and 100k in credits as headline sponsor of our first hackathon. 150 engineers will build on your platform for a weekend and you will meet the ones you want to hire.","p_deal":"A bank wanted access to student developers; I gave them a challenge track; they hired four interns.","p_calls":"Head of DevRel at a cloud provider, CTO at a Riyadh fintech, Dean of engineering at a university.","p_markets":["Saudi Arabia","United Arab Emirates"],"hours":"5-10"}', 'https://example.com/cv-mariam.pdf', now() - interval '2 days', now() - interval '1 day', sara),
    ('careers', editorial, 'Task review', 'yara@example.com', 'Yara H.', 'ar', '{"name":"Yara H.","email":"yara@example.com","country":"Lebanon","best":"كتبت لثلاث سنين عن التقنية في بيروت.","hours":"10+"}', null, now() - interval '5 days', now() - interval '3 days', layla),
    ('careers', engineering, 'Interview', 'ali@example.com', 'Ali M.', 'en', '{"name":"Ali M.","email":"ali@example.com","country":"Qatar","best":"Shipped an Arabic RAG system used by 2k lawyers.","hours":"5-10"}', null, now() - interval '7 days', now() - interval '4 days', yousef),
    ('careers', events, 'Offer', 'salma@example.com', 'Salma D.', 'en', '{"name":"Salma D.","email":"salma@example.com","country":"Tunisia","best":"Produced a podcast with 50 episodes and 20k monthly listeners.","hours":"10+"}', null, now() - interval '7 days', now() - interval '2 days', owner),
    ('house', null, 'New', 'founder@example.com', 'Faisal R.', 'en', '{"name":"Faisal R.","email":"founder@example.com","company":"Dhow Labs","country":"Kuwait","stage":"users","fulltime":"yes","built":"https://example.com","why":"An Arabic voice agent for clinics."}', null, now() - interval '6 hours', now() - interval '6 hours', null);
  insert into public.rubric_scores (application_id, profile_id, criterion, score) values
    ((select id from public.applications where email='mariam@example.com'), owner, 'ask', 4), ((select id from public.applications where email='mariam@example.com'), owner, 'market', 4), ((select id from public.applications where email='mariam@example.com'), owner, 'yes', 3);
  update public.applications set score = 3.67 where email = 'mariam@example.com';
  update public.applications set score = 4 where email in ('nada@example.com', 'ali@example.com');
  update public.applications set score = 3 where email = 'karim@example.com';
  update public.applications set score = 5 where email in ('yara@example.com', 'salma@example.com');

  insert into public.subscribers (email, lang, sources, status, confirmed_at) select 'reader' || g || '@example.com', case when g % 3 = 0 then 'en' else 'ar' end, '{home}', 'active', now() from generate_series(1, 24) g;
end $$;
