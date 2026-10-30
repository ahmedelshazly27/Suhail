-- Teams bot conversation reference per person, written by /api/teams/messages when they first talk to the bot.
alter table public.profiles add column if not exists teams_ref jsonb;
