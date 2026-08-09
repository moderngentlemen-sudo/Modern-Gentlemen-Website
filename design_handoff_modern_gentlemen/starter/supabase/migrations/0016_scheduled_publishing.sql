-- 0016 — The runner that fires a scheduled publish.
--
-- `schedule_document` has existed since 0010 and its own comment says the
-- runner "arrives in Phase 6". Until now nothing did: the builder could set a
-- page or article to 'scheduled' with a `scheduled_for` date, and the row sat
-- there forever. This is the thing that fires it.
--
-- WHY THIS NEEDS security definer, WHICH resolve_preview WAS SUPPOSED TO BE THE
-- ONLY ONE OF.
--
-- `publish_document` is `security invoker` and asserts
-- `has_permission(<type>.publish)`. `has_permission` resolves through
-- `auth.uid()`, which is **null for the service-role key** — so a background job
-- holding that key is not "an admin", it is nobody, and calling
-- `publish_document` from a runner raises 42501 every time. There is no session
-- to borrow: the whole point of a scheduled publish is that it happens when no
-- one is signed in.
--
-- The alternatives were worse. Storing an editor's email and password so the
-- runner could sign in puts a human credential in an env var and files every
-- scheduled publish under a person who was asleep. Impersonating a user by
-- writing `request.jwt.claims` inside the function is impersonation in SQL,
-- which is a far larger and much less obvious capability than this.
--
-- So: definer, and **granted to `service_role` alone** — revoked from `public`,
-- `anon` and `authenticated`. Nothing reachable with a browser's key can call
-- it. The capability it holds is narrow by construction: it publishes only rows
-- that are already `status = 'scheduled'` with a `scheduled_for` in the past,
-- and it cannot be asked to publish anything else. A caller who wanted to
-- publish an arbitrary document with it would first have to schedule that
-- document — which goes through `schedule_document`, which does check the
-- permission.
--
-- WHERE THE AUTHORISATION ACTUALLY HAPPENS. At scheduling time.
-- `schedule_document` asserts `<type>.publish` before it will set a date. This
-- function is the deferred execution of a decision already authorised, which is
-- why it takes no actor and why it does not re-check. `publish_events.actor_id`
-- and `revisions.created_by` are both nullable, and a scheduled publish is
-- exactly the actorless case the schema left room for.
--
-- ON DUPLICATING THE WRITE SEQUENCE. The three writes below are the same three
-- `publish_document` makes, and this repo does not like two implementations of
-- one thing. Sharing the body is not available: `publish_document` runs as the
-- caller and this runs as the owner, and any function both could call would
-- have to be executable by `authenticated` — which would hand every signed-in
-- user an unchecked publish. The guard is a test instead:
-- `tests/integration/scheduledPublishing.test.ts` publishes one document each
-- way and asserts the resulting row, revision and publish_event are identical
-- but for the actor. Behavioural equivalence, checked on every CI run.

create or replace function public.run_due_publishes(p_limit integer default 100)
returns table (
  entity_type text,
  entity_id   uuid,
  slug        text,
  version     integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type   text;
  v_table  text;
  v_row    record;
  v_from   integer;
  v_to     integer;
  v_draft  jsonb;
  v_slug   text;
  v_count  integer := 0;
begin
  -- Only the types `schedulable_document_table` admits. Products carry a
  -- 'scheduled' value in their status CHECK and no `scheduled_for` column to
  -- hold a date, which is why they are deliberately not on this list — see the
  -- known issue recorded in PROGRESS.md.
  foreach v_type in array array['page', 'article']
  loop
    v_table := public.schedulable_document_table(v_type);
    continue when v_table is null;

    -- FOR UPDATE SKIP LOCKED so two runners firing at once cannot both claim
    -- the same document. Overlapping runs are not hypothetical: a cron that
    -- fires every minute and a run that takes longer than a minute is the
    -- ordinary way this goes wrong.
    for v_row in execute format(
      'select id from public.%I
        where status = ''scheduled''
          and scheduled_for is not null
          and scheduled_for <= now()
        order by scheduled_for
        limit $1
        for update skip locked', v_table)
      using p_limit
    loop
      execute format('select version, draft_data, slug from public.%I where id = $1', v_table)
        into v_from, v_draft, v_slug
        using v_row.id;

      v_to := v_from + 1;

      -- The same three writes publish_document makes, in one transaction.
      execute format(
        'update public.%I
            set published_data = draft_data,
                version        = $1,
                status         = ''published'',
                published_at   = now(),
                scheduled_for  = null
          where id = $2', v_table)
        using v_to, v_row.id;

      -- `created_by` and `actor_id` stay null: nobody did this. The note names
      -- the mechanism so an editor reading the history is not left guessing why
      -- a publish has no name against it.
      insert into public.revisions (entity_type, entity_id, version, data, reason, note, created_by)
      values (v_type, v_row.id, v_to, v_draft, 'publish', 'Published on schedule', null);

      insert into public.publish_events
        (entity_type, entity_id, action, from_version, to_version, note, actor_id)
      values (v_type, v_row.id, 'publish', v_from, v_to, 'Published on schedule', null);

      entity_type := v_type;
      entity_id   := v_row.id;
      slug        := v_slug;
      version     := v_to;
      return next;

      v_count := v_count + 1;
      exit when v_count >= p_limit;
    end loop;
  end loop;
end;
$$;

-- Nothing a browser can reach may call this. `service_role` only — which in
-- practice means the jobs route, holding the key and its own JOBS_SECRET.
revoke execute on function public.run_due_publishes(integer) from public, anon, authenticated;
grant execute on function public.run_due_publishes(integer) to service_role;
