-- First-sign-in walkthrough: set when someone finishes or skips the dashboard tour, cleared by "Replay the tour".
-- Written only by server actions (service role), like onboarded_at.
alter table public.profiles add column if not exists toured_at timestamptz;
