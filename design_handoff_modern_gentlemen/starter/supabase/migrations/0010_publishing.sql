-- 0010 — Publishing, rollback and preview resolution as database transactions.
--
-- WHY THIS IS SQL AND NOT TYPESCRIPT
-- Publishing writes three things: the entity's published_data, a revisions
-- snapshot, and a publish_events audit row. Over PostgREST those are three
-- separate requests, so a failure between them leaves a published page with no
-- history — the exact situation the audit trail exists to prevent. Here they
-- are one transaction.
--
-- These are SECURITY INVOKER: RLS still evaluates as the editor, and the
-- service-role key stays out of the request path. `resolve_preview` is the one
-- exception and is explained where it is defined.
--
-- AMENDMENT TO THE 0003 COMMENT: `version` was described there as incrementing
-- "on publish". It now increments on every operation that writes a revision —
-- publish, snapshot and restore. `revisions` is keyed unique on
-- (entity_type, entity_id, version), so if snapshot and restore did not
-- advance it they could not write history at all without colliding with the
-- publish that already claimed that number. One counter, no divergence, and
-- `revisions.version` genuinely means "the payload at that version".

-- ---------------------------------------------------------------------------
-- Entity type -> table, as an allowlist.
--
-- Every function below interpolates a table name into dynamic SQL. Resolving it
-- through this function rather than trusting the argument is what stops that
-- being an injection: an unknown type yields NULL and the caller raises.
--
-- Not every versioned table is here. `categories` carries the same columns but
-- is not independently publishable, and adding it would imply a UI that does
-- not exist.
-- ---------------------------------------------------------------------------
create or replace function public.document_table(p_entity_type text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_entity_type
    when 'page'     then 'pages'
    when 'template' then 'templates'
    when 'pattern'  then 'patterns'
    when 'article'  then 'articles'
  end;
$$;

-- Scheduling needs a `scheduled_for` column and a 'scheduled' status, which
-- only pages and articles have.
create or replace function public.schedulable_document_table(p_entity_type text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_entity_type
    when 'page'    then 'pages'
    when 'article' then 'articles'
  end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLISH — draft_data becomes the live payload.
--
-- Publishing also clears any pending schedule, but only pages and articles
-- have a `scheduled_for` column, so that clause is built per entity type
-- rather than assumed.
-- ---------------------------------------------------------------------------
create or replace function public.publish_document(
  p_entity_type text,
  p_entity_id   uuid,
  p_note        text default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_table         text := public.document_table(p_entity_type);
  v_from_version  integer;
  v_to_version    integer;
  v_draft         jsonb;
  v_clear_sched   text := case when public.schedulable_document_table(p_entity_type) is not null
                               then ', scheduled_for = null' else '' end;
begin
  if v_table is null then
    raise exception 'not a publishable entity type: %', p_entity_type
      using errcode = '22023';
  end if;

  -- RLS on the entity tables gates `<type>.write`. Publishing is a distinct,
  -- higher act and needs its own permission. Asserting it here rather than only
  -- in the service means a bug in application code cannot publish something the
  -- editor themselves could not.
  if not public.has_permission(p_entity_type || '.publish') then
    raise exception 'permission denied: %.publish', p_entity_type
      using errcode = '42501';
  end if;

  -- FOR UPDATE serialises concurrent publishes of the same entity, so two
  -- editors cannot both claim the same version number.
  execute format('select version, draft_data from public.%I where id = $1 for update', v_table)
    into v_from_version, v_draft
    using p_entity_id;

  -- Also the path taken when RLS hides the row, which is the right answer:
  -- you cannot publish what you cannot see.
  if v_from_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  v_to_version := v_from_version + 1;

  execute format(
    'update public.%I
        set published_data = draft_data,
            version        = $1,
            status         = ''published'',
            published_at   = now(),
            updated_by     = auth.uid()%s
      where id = $2', v_table, v_clear_sched)
    using v_to_version, p_entity_id;

  insert into public.revisions (entity_type, entity_id, version, data, reason, note, created_by)
  values (p_entity_type, p_entity_id, v_to_version, v_draft, 'publish', p_note, auth.uid());

  insert into public.publish_events
    (entity_type, entity_id, action, from_version, to_version, note, actor_id)
  values (p_entity_type, p_entity_id, 'publish', v_from_version, v_to_version, p_note, auth.uid());

  return v_to_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- UNPUBLISH — take it off the site without destroying anything.
--
-- `published_data` is deliberately left in place: RLS already hides a
-- non-published row from the public, and keeping the payload makes
-- re-publishing one step instead of a restore. No revision is written because
-- no payload changed.
-- ---------------------------------------------------------------------------
create or replace function public.unpublish_document(
  p_entity_type text,
  p_entity_id   uuid,
  p_note        text default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_table   text := public.document_table(p_entity_type);
  v_version integer;
begin
  if v_table is null then
    raise exception 'not a publishable entity type: %', p_entity_type
      using errcode = '22023';
  end if;

  if not public.has_permission(p_entity_type || '.publish') then
    raise exception 'permission denied: %.publish', p_entity_type
      using errcode = '42501';
  end if;

  execute format('select version from public.%I where id = $1 for update', v_table)
    into v_version using p_entity_id;

  if v_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  execute format(
    'update public.%I
        set status = ''draft'', published_at = null, updated_by = auth.uid()
      where id = $1', v_table)
    using p_entity_id;

  insert into public.publish_events
    (entity_type, entity_id, action, from_version, to_version, note, actor_id)
  values (p_entity_type, p_entity_id, 'unpublish', v_version, v_version, p_note, auth.uid());

  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- SNAPSHOT — a named checkpoint of the current draft, without publishing.
-- ---------------------------------------------------------------------------
create or replace function public.snapshot_document(
  p_entity_type text,
  p_entity_id   uuid,
  p_label       text default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_table        text := public.document_table(p_entity_type);
  v_to_version   integer;
  v_draft        jsonb;
begin
  if v_table is null then
    raise exception 'not a publishable entity type: %', p_entity_type
      using errcode = '22023';
  end if;

  if not public.has_permission(p_entity_type || '.write') then
    raise exception 'permission denied: %.write', p_entity_type using errcode = '42501';
  end if;

  execute format('select version + 1, draft_data from public.%I where id = $1 for update', v_table)
    into v_to_version, v_draft
    using p_entity_id;

  if v_to_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  execute format('update public.%I set version = $1, updated_by = auth.uid() where id = $2', v_table)
    using v_to_version, p_entity_id;

  insert into public.revisions (entity_type, entity_id, version, data, reason, label, created_by)
  values (p_entity_type, p_entity_id, v_to_version, v_draft, 'snapshot', p_label, auth.uid());

  return v_to_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- ROLLBACK — copy an old payload FORWARD into the draft.
--
-- Nothing is deleted and nothing is published: the editor gets the old content
-- back as a draft, reviews it, and publishes if they meant it. An undo that
-- silently went live would be a worse mistake than the one it was undoing.
-- Guarded by `revision.restore` rather than `<type>.publish` for that reason.
-- ---------------------------------------------------------------------------
create or replace function public.rollback_document(
  p_entity_type text,
  p_entity_id   uuid,
  p_version     integer,
  p_note        text default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_table        text := public.document_table(p_entity_type);
  v_from_version integer;
  v_to_version   integer;
  v_payload      jsonb;
begin
  if v_table is null then
    raise exception 'not a publishable entity type: %', p_entity_type
      using errcode = '22023';
  end if;

  if not public.has_permission('revision.restore') then
    raise exception 'permission denied: revision.restore' using errcode = '42501';
  end if;

  select data into v_payload
    from public.revisions
   where entity_type = p_entity_type and entity_id = p_entity_id and version = p_version;

  if v_payload is null then
    raise exception 'no revision % for % %', p_version, p_entity_type, p_entity_id
      using errcode = 'P0002';
  end if;

  execute format('select version from public.%I where id = $1 for update', v_table)
    into v_from_version using p_entity_id;

  if v_from_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  v_to_version := v_from_version + 1;

  execute format(
    'update public.%I
        set draft_data = $1, version = $2, updated_by = auth.uid()
      where id = $3', v_table)
    using v_payload, v_to_version, p_entity_id;

  insert into public.revisions (entity_type, entity_id, version, data, reason, note, created_by)
  values (p_entity_type, p_entity_id, v_to_version, v_payload, 'restore', p_note, auth.uid());

  insert into public.publish_events
    (entity_type, entity_id, action, from_version, to_version, note, actor_id)
  values (p_entity_type, p_entity_id, 'rollback', p_version, v_to_version, p_note, auth.uid());

  return v_to_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- SCHEDULE — pages and articles only (see schedulable_document_table).
-- Phase 3 records the intent; the runner that fires it arrives in Phase 6.
-- ---------------------------------------------------------------------------
create or replace function public.schedule_document(
  p_entity_type text,
  p_entity_id   uuid,
  p_when        timestamptz,
  p_note        text default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_table   text := public.schedulable_document_table(p_entity_type);
  v_version integer;
begin
  if v_table is null then
    raise exception '% cannot be scheduled', p_entity_type using errcode = '22023';
  end if;

  if not public.has_permission(p_entity_type || '.publish') then
    raise exception 'permission denied: %.publish', p_entity_type using errcode = '42501';
  end if;

  if p_when <= now() then
    raise exception 'scheduled time must be in the future' using errcode = '22023';
  end if;

  execute format('select version from public.%I where id = $1 for update', v_table)
    into v_version using p_entity_id;

  if v_version is null then
    raise exception 'no such %: %', p_entity_type, p_entity_id using errcode = 'P0002';
  end if;

  execute format(
    'update public.%I
        set status = ''scheduled'', scheduled_for = $1, updated_by = auth.uid()
      where id = $2', v_table)
    using p_when, p_entity_id;

  insert into public.publish_events
    (entity_type, entity_id, action, from_version, to_version, note, actor_id)
  values (p_entity_type, p_entity_id, 'schedule', v_version, v_version, p_note, auth.uid());

  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- RESOLVE PREVIEW — the one SECURITY DEFINER function here, and why.
--
-- A preview link has to work for someone who is not staff and may not be signed
-- in at all. RLS cannot express that: `preview_sessions` is readable only by its
-- creator or staff, and a draft page is readable only by staff. The three ways
-- out are not equal.
--
--   Loosening the preview_sessions SELECT policy to `using (true)` would let
--   anyone enumerate every live token. No.
--
--   Resolving the token with the service-role key would put a full RLS bypass
--   on a public, unauthenticated route — the thing the standing rule forbids.
--
--   This: the capability check happens inside the database, and the function
--   returns nothing but the draft payload for one valid, unexpired token. No
--   service-role key touches the request path, and holding a token grants
--   exactly one thing.
--
-- Tokens are 256 bits of randomness, so the `=` comparison not being
-- constant-time is not a practical exposure. There is no rate limiting on this
-- endpoint yet — tracked in PROGRESS.md.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_preview(p_token text)
returns table (
  entity_type text,
  entity_id   uuid,
  device      text,
  expires_at  timestamptz,
  data        jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.preview_sessions%rowtype;
  v_table   text;
  v_data    jsonb;
begin
  select * into v_session
    from public.preview_sessions ps
   where ps.token = p_token and ps.expires_at > now();

  -- An expired or unknown token returns an empty set, not an error: the route
  -- shows "this link has expired" either way, and distinguishing them would
  -- confirm to a guesser that a token was once real.
  if not found then
    return;
  end if;

  v_table := public.document_table(v_session.entity_type);
  if v_table is null then
    return;
  end if;

  execute format('select draft_data from public.%I where id = $1', v_table)
    into v_data using v_session.entity_id;

  return query
    select v_session.entity_type, v_session.entity_id, v_session.device,
           v_session.expires_at, v_data;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants, following the convention set by 0009.
--
-- Postgres grants EXECUTE to PUBLIC on creation, so each function is revoked
-- and then granted deliberately. The mutating functions are for signed-in
-- staff: `authenticated` is the role an editor's session carries, and the
-- permission checks inside each function plus RLS do the real gating.
-- `anon` gets `resolve_preview` and nothing else.
-- ---------------------------------------------------------------------------
revoke execute on function public.document_table(text) from public, anon;
revoke execute on function public.schedulable_document_table(text) from public, anon;
revoke execute on function public.publish_document(text, uuid, text) from public, anon;
revoke execute on function public.unpublish_document(text, uuid, text) from public, anon;
revoke execute on function public.snapshot_document(text, uuid, text) from public, anon;
revoke execute on function public.rollback_document(text, uuid, integer, text) from public, anon;
revoke execute on function public.schedule_document(text, uuid, timestamptz, text) from public, anon;

grant execute on function public.document_table(text) to authenticated;
grant execute on function public.schedulable_document_table(text) to authenticated;
grant execute on function public.publish_document(text, uuid, text) to authenticated;
grant execute on function public.unpublish_document(text, uuid, text) to authenticated;
grant execute on function public.snapshot_document(text, uuid, text) to authenticated;
grant execute on function public.rollback_document(text, uuid, integer, text) to authenticated;
grant execute on function public.schedule_document(text, uuid, timestamptz, text) to authenticated;

revoke execute on function public.resolve_preview(text) from public;
grant execute on function public.resolve_preview(text) to anon, authenticated;
