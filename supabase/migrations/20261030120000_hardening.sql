-- Security review fixes.

-- 1. Identity and integration columns on profiles are written only by server code (service role, where auth.uid()
--    is null): sign-in sync, the Teams bot and the ICS token generator. Signed-in people, admins included, cannot
--    change them through the API. This stops a member pointing teams_ref.serviceUrl at their own server (which would
--    receive the bot's token), changing their email, or picking a guessable calendar token.
create or replace function public.guard_profile_identity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (
       new.email is distinct from old.email or new.ms_oid is distinct from old.ms_oid
    or new.ms_groups is distinct from old.ms_groups or new.teams_ref is distinct from old.teams_ref
    or new.ics_token is distinct from old.ics_token) then
    raise exception 'these profile fields are managed by Suhail';
  end if;
  return new;
end $$;
create trigger profiles_identity_guard before update on public.profiles for each row execute function public.guard_profile_identity();

-- 2. Postgres grants EXECUTE to PUBLIC by default, so revoking from anon alone left these callable anonymously.
revoke execute on function public.hit_rate_limit(text, text, int, int) from public;
grant execute on function public.hit_rate_limit(text, text, int, int) to service_role;
revoke execute on function public.my_role(), public.is_team(), public.is_admin(), public.is_owner(), public.is_finance() from public;
grant execute on function public.my_role(), public.is_team(), public.is_admin(), public.is_owner(), public.is_finance() to authenticated, service_role;
revoke execute on function public.guard_owner_role(), public.guard_profile_identity() from public;

-- 3. Notifications are created by server code only (lib/notify.ts uses the service role), so nobody can send a
--    teammate a spoofed notification with an outside link.
drop policy if exists team_insert on public.notifications;

-- 4. Finance cannot approve their own expenses. Owners can, so a one-person finance team is never stuck.
drop policy if exists finance_update on public.expenses;
create policy finance_update on public.expenses for update to authenticated
  using (public.is_finance() and (created_by is distinct from auth.uid() or public.is_owner()))
  with check (public.is_finance() and (created_by is distinct from auth.uid() or public.is_owner()));
