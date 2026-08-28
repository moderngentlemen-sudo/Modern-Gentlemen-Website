-- 0025 — two unrelated defects that happen to be one migration each.
--
-- Kept together because neither is worth a file of its own and both were found
-- in the same audit pass. They share no code.
--
-- ===========================================================================
-- 1. `site_settings` is world-readable
-- ===========================================================================
-- `0001` gave it `for select using (true)` — every row, to `anon`, forever. The
-- table is **empty today**, and that is exactly why this is worth doing now
-- rather than later: nothing has to be migrated, no screen breaks, and the
-- decision costs nothing. Checked rather than assumed — `grep` finds no reader
-- anywhere in `app/`, `components/` or `lib/`, and `select count(*)` is 0.
--
-- ⚠️ **A table named "settings" is the kind that acquires an operational value
-- nobody meant to publish.** An API base URL, a feature flag naming an unshipped
-- product, a support address, a webhook path. The failure mode is not that
-- somebody adds a secret on purpose; it is that the row looks innocuous and the
-- policy was written before anyone knew what would go in it.
--
-- **So reads become staff-only, which is the direction that fails safe.** If a
-- genuinely public setting arrives later — a site name, a social handle — the
-- right move is a *narrow* policy naming those keys, not restoring
-- `using (true)`. That is a smaller decision to take with a real key in front of
-- you than the blanket one taken here in the abstract.
--
-- `is_staff()` rather than a permission: `settings.write` already gates writes,
-- and inventing `settings.read` would seed a permission no role holds and no UI
-- checks — the shape this repo has recorded twice.

drop policy if exists "site_settings: public read" on public.site_settings;

drop policy if exists "site_settings: staff read" on public.site_settings;
create policy "site_settings: staff read" on public.site_settings
  for select using (public.is_staff());

-- ===========================================================================
-- 2. Saving feed mappings is not atomic
-- ===========================================================================
-- `replaceMappings` in `lib/db/repositories/ingestion.ts` is a DELETE followed
-- by an INSERT — **two PostgREST round trips with no transaction around them.**
-- Between the two the source has zero mappings, and if the second never
-- arrives (a closed tab, a dropped connection, a 500) it stays that way. The
-- editor sees no error because nothing failed on their side; the source is
-- simply empty the next time anyone looks, and an import that used to map ten
-- fields now maps none.
--
-- Found via E2E flakiness rather than by reading the code, which is the usual
-- way a non-atomic write announces itself: intermittently, and looking like a
-- test problem.
--
-- ⚠️ **`security invoker`, and that is the whole design.** A `security definer`
-- function would run as the owner and bypass the caller's RLS — which would
-- quietly break this repo's oldest standing rule, that admin writes go through
-- the editor's own session against RLS. As an invoker function the policies on
-- `feed_field_mappings` still decide: `integration.write` is required for both
-- the delete and the insert, exactly as before. All this changes is that the
-- two now succeed or fail together.
--
-- The argument is `jsonb` rather than a table type or an array of composites,
-- because PostgREST passes RPC arguments as JSON and a composite array would
-- have to be reconstructed on the way in anyway. `jsonb_to_recordset` does that
-- reconstruction in one expression, and a malformed payload fails there rather
-- than writing half a set.
--
-- Re-runnable: `create or replace function` is idempotent by definition, and
-- each policy is dropped before it is created.

create or replace function public.replace_feed_mappings(
  p_source_id uuid,
  p_mappings  jsonb
)
returns void
language plpgsql
-- Not `security definer`. See the note above: the caller's RLS must still apply.
security invoker
set search_path to 'public'
as $$
begin
  -- Both statements are in this function's implicit transaction, so an error in
  -- the insert rolls the delete back with it. That is the entire fix.
  delete from public.feed_field_mappings where source_id = p_source_id;

  -- `jsonb_array_length` rather than a null check: `'[]'::jsonb` is a legitimate
  -- payload meaning "this source has no mappings", and must clear them without
  -- attempting an insert of zero rows.
  if p_mappings is null or jsonb_array_length(p_mappings) = 0 then
    return;
  end if;

  insert into public.feed_field_mappings
    (source_id, target_field, source_path, transform, fallback, is_required)
  select
    p_source_id,
    m.target_field,
    m.source_path,
    m.transform,
    m.fallback,
    coalesce(m.is_required, false)
  from jsonb_to_recordset(p_mappings) as m(
    target_field text,
    source_path  text,
    transform    text,
    fallback     text,
    is_required  boolean
  );
end;
$$;

comment on function public.replace_feed_mappings(uuid, jsonb) is
  'Replace one source''s feed mappings atomically. security invoker, so the caller''s RLS still applies.';

-- The function is called by staff through their own session. `anon` has no
-- business here and is not granted execute.
revoke all on function public.replace_feed_mappings(uuid, jsonb) from public, anon;
grant execute on function public.replace_feed_mappings(uuid, jsonb) to authenticated, service_role;
