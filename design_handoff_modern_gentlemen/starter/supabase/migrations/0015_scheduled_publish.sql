-- ---------------------------------------------------------------------------
-- 0015 — the runner that fires a scheduled publish.
--
-- `schedule_document` has existed since 0010 and the builder has been able to
-- set a date since Phase 4, but nothing ever fired one: the builder says so
-- plainly rather than implying otherwise. This is that runner's database half.
--
-- The problem it has to solve is authorisation. `publish_document` asserts
-- `has_permission('<type>.publish')`, which reads `auth.uid()` — and a
-- scheduled job has no user. Three ways out, only one of them good:
--
--   Give the job an account and sign in as it. A real credential with publish
--   rights, stored somewhere, usable by anything that finds it. No.
--
--   Publish with the service-role key from application code, reimplementing
--   the transaction over PostgREST. That is exactly what 0010 exists to
--   prevent — three writes that must succeed or fail together.
--
--   This: a `security definer` function that reuses 0010's own writes. The
--   argument that makes it safe is that **the authorisation already happened**.
--   `schedule_document` asserted `<type>.publish` at the moment an editor
--   scheduled the document; the runner carries out a decision that was already
--   authorised rather than making a new one. It can publish nothing that is not
--   already marked `scheduled` with a due date, and it is granted to
--   `service_role` alone.
--
-- This is the second `security definer` function in the schema. `resolve_preview`
-- was the first and its header explains the same shape of reasoning: a
-- capability RLS cannot express, narrowed to one specific thing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- A schema PostgREST does not expose.
--
-- The extracted helper below performs **no permission check** — that is the
-- point of extracting it — so it must not be callable over the API. Granting it
-- to `authenticated` in `public` would hand anyone with `<type>.write` the
-- ability to publish, which is precisely the gate `publish_document` exists to
-- enforce and which `publishing.test.ts` asserts is real.
--
-- PostgREST only exposes the schemas it is configured with (`public`), so a
-- function in `private` is reachable from other functions and from a direct
-- database connection, and not from a browser. `authenticated` needs USAGE
-- because `publish_document` runs as the caller and calls into it.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The publish transaction, extracted.
--
-- `publish_document` used to hold both the permission check and the writes.
-- Splitting them means the runner shares the *one* implementation instead of
-- carrying a second copy that drifts — the failure this repo has already paid
-- for twice, in the manifest/registry split and the reading-time suffix.
--
-- Deliberately SECURITY INVOKER. Called from `publish_document` it runs as the
-- editor and RLS still applies, so the existing path is unchanged. Called from
-- the definer function below it runs with the definer's privileges, which is
-- what a job with no user needs. The actor is a parameter rather than
-- `auth.uid()` so both callers can say truthfully who acted — the job says
-- nobody, and records null.
-- ---------------------------------------------------------------------------
create or replace function private.publish_document_writes(
  p_entity_type text,
  p_entity_id   uuid,
  p_note        text,
  p_actor       uuid
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
            updated_by     = $3%s
      where id = $2', v_table, v_clear_sched)
    using v_to_version, p_entity_id, p_actor;

  insert into public.revisions (entity_type, entity_id, version, data, reason, note, created_by)
  values (p_entity_type, p_entity_id, v_to_version, v_draft, 'publish', p_note, p_actor);

  insert into public.publish_events
    (entity_type, entity_id, action, from_version, to_version, note, actor_id)
  values (p_entity_type, p_entity_id, 'publish', v_from_version, v_to_version, p_note, p_actor);

  return v_to_version;
end;
$$;

-- `publish_document` keeps its signature, its permission check and its
-- semantics exactly. Only the writes moved.
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
begin
  if public.document_table(p_entity_type) is null then
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

  return private.publish_document_writes(p_entity_type, p_entity_id, p_note, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- The runner.
--
-- Returns what it published so the caller can revalidate the affected paths —
-- including an article's category, whose listing is bound to the articles table
-- and goes stale the moment one is published.
--
-- `for update skip locked` so two runners firing at once cannot publish the
-- same document twice; the second simply sees fewer rows.
-- ---------------------------------------------------------------------------
create or replace function public.run_due_publishes(p_limit integer default 100)
returns table (entity_type text, entity_id uuid, version integer, slug text, category_slug text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  -- The schedulable types, which `schedulable_document_table` already gates.
  -- Mirrors SCHEDULABLE_TYPES in lib/domain/documents.ts; `scheduled_publish`
  -- integration coverage asserts a non-schedulable type stays untouched.
  v_types text[] := array['page', 'article'];
  v_type  text;
  v_table text;
  v_row   record;
begin
  foreach v_type in array v_types loop
    v_table := public.schedulable_document_table(v_type);
    continue when v_table is null;

    for v_row in execute format(
      'select id, slug from public.%I
        where status = ''scheduled'' and scheduled_for <= now()
        order by scheduled_for
        limit $1
        for update skip locked', v_table)
      using p_limit
    loop
      entity_type := v_type;
      entity_id   := v_row.id;
      slug        := v_row.slug;
      version     := private.publish_document_writes(
                       v_type, v_row.id, 'Published on schedule', null);

      category_slug := null;
      if v_type = 'article' then
        select c.slug into category_slug
          from public.articles a
          left join public.categories c on c.id = a.category_id
         where a.id = v_row.id;
      end if;

      return next;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. `authenticated` can execute the writes helper only because
-- `publish_document` calls it in the caller's own context — and it sits in
-- `private`, which PostgREST does not expose, so that grant is not an API
-- surface. The runner is service_role only: it is the one function here that
-- publishes without a user, and nothing reachable from a browser should be
-- able to invoke it.
-- ---------------------------------------------------------------------------
revoke execute on function private.publish_document_writes(text, uuid, text, uuid) from public;
grant execute on function private.publish_document_writes(text, uuid, text, uuid)
  to authenticated, service_role;

revoke execute on function public.run_due_publishes(integer) from public, anon, authenticated;
grant execute on function public.run_due_publishes(integer) to service_role;
