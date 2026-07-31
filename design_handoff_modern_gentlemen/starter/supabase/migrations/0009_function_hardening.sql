-- 0009 — Function hardening, in response to the Supabase security advisor.
--
-- Three fixes, and one deliberate non-fix documented below.

-- 1. touch_updated_at ran with a mutable search_path. A trigger function
--    without a pinned search_path can be induced to resolve an unqualified
--    name against an attacker-controlled schema.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. handle_new_user is a trigger function on auth.users. It has no business
--    being reachable over the REST RPC endpoint, where a signed-in user could
--    invoke it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. purge_expired_preview_sessions is housekeeping run by the scheduled job
--    runner with the service-role key. No browser client should call it.
revoke execute on function public.purge_expired_preview_sessions()
  from public, anon, authenticated;

-- DELIBERATELY NOT REVOKED: has_permission(), is_admin() and is_staff().
--
-- These are called from inside RLS policies, and a policy is evaluated with the
-- privileges of the role running the query. Revoking EXECUTE from `anon` or
-- `authenticated` would make every policy that calls them fail closed — the
-- public site would stop reading published content.
--
-- The exposure is acceptable: each function reports only whether the CALLER
-- holds a permission, which the caller can already determine by observing what
-- the API lets them do. They leak no other user's grants and no data.
