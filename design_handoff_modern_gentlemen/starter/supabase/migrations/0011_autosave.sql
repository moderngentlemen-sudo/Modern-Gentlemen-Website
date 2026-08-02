-- 0011 — Fix autosave revisions, which could never be written after a publish.
--
-- THE BUG
-- `revisions` is unique on (entity_type, entity_id, version). `publish_document`
-- sets the entity's version to N and writes its revision at N, so after any
-- publish the current version number is already taken. The autosave path wrote
-- at the *current* version and swallowed the resulting unique violation as
-- "this version already has its checkpoint" — so from the first publish onward
-- the throttle correctly decided to write a checkpoint and the write was
-- silently discarded, every time. Autosave history only ever worked on a
-- document that had never been published.
--
-- THE FIX
-- Autosave advances the version like every other operation that writes a
-- revision. That is the rule `0010` already established for publish, snapshot
-- and restore — autosave was the one exception, and it is exactly the exception
-- that did not work. One counter, no special cases, every revision addressable
-- by version so `rollback_document` can target any of them.
--
-- Version numbers now climb with editing rather than only with publishing. That
-- is honest: a version is a recorded state, and an autosave is one. History
-- surfaces can filter on `reason` when they only want publishes.
--
-- Doing this in SQL also makes autosave atomic. The previous implementation was
-- a bare INSERT from the client that could interleave with a concurrent publish
-- claiming the same number.

create or replace function public.autosave_document(
  p_entity_type text,
  p_entity_id   uuid
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $fn$
declare
  v_table      text := public.document_table(p_entity_type);
  v_to_version integer;
  v_draft      jsonb;
begin
  if v_table is null then
    raise exception 'not a versioned entity type: %', p_entity_type using errcode = '22023';
  end if;

  -- Autosave is part of editing, so it needs no more than write access.
  if not public.has_permission(p_entity_type || '.write') then
    raise exception 'permission denied: %.write', p_entity_type using errcode = '42501';
  end if;

  -- Captures the draft as it stands *before* the caller overwrites it, which is
  -- the state worth being able to return to.
  execute format('select version + 1, draft_data from public.%I where id = $1 for update', v_table)
    into v_to_version, v_draft
    using p_entity_id;

  if v_to_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  execute format('update public.%I set version = $1, updated_by = auth.uid() where id = $2', v_table)
    using v_to_version, p_entity_id;

  insert into public.revisions (entity_type, entity_id, version, data, reason, created_by)
  values (p_entity_type, p_entity_id, v_to_version, v_draft, 'autosave', auth.uid());

  return v_to_version;
end;
$fn$;

revoke execute on function public.autosave_document(text, uuid) from public, anon;
grant execute on function public.autosave_document(text, uuid) to authenticated;
