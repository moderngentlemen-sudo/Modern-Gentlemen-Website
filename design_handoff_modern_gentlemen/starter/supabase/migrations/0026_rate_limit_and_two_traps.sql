-- 0026 — a rate limiter for the public write endpoint, and two latent traps.
--
-- ===========================================================================
-- 1. Rate limiting, and why it has to be in the database
-- ===========================================================================
-- `POST /api/newsletter` (`0024`) is the site's first **unauthenticated write**.
-- The `unique (email)` constraint bounds repeats of one address; nothing bounds
-- a flood of distinct ones, so the table can be filled by anybody.
--
-- ⚠️ **An in-process counter would be worse than nothing here.** Railway can run
-- more than one container, and Next route handlers are not guaranteed to share
-- a process even within one — so a Map keyed by IP would enforce a limit that
-- varies with how the platform happens to schedule you, and would read as
-- working in every test. The state has to be somewhere both containers can see,
-- and the database is the only such place this deployment has.
--
-- **A fixed window, not a sliding one.** A sliding window needs either a row per
-- request or a sorted structure; a fixed window needs one row per key and an
-- `on conflict do update`. The cost is the usual one — a caller can send `limit`
-- requests at the end of one window and `limit` more at the start of the next,
-- so the true worst case is 2× over a window boundary. That is the right trade
-- for a sign-up form: the limit exists to stop bulk insertion, not to meter an
-- API anyone pays for.
--
-- ⚠️ **`security definer`, and here that is correct where `0025` needed the
-- opposite.** `replace_feed_mappings` had to stay `invoker` so the editor's RLS
-- still applied. This one must be `definer`: the caller is `anon`, and the whole
-- point is that they can consume a counter they cannot read, edit or delete. So
-- the table stays entirely ungranted to `anon` and the function is the only door.
-- `search_path` is pinned, which is what makes a definer function safe.
--
-- The function returns whether the caller may proceed, and never raises: a
-- limiter that throws turns a burst into a 500 and loses the sign-up it was
-- meant to be protecting.

create table if not exists public.rate_limits (
  -- The bucket: caller identity plus the thing being limited. Hashed by the
  -- caller, so this table never holds a raw IP address — a rate limiter should
  -- not become the one place the site logs who visited it.
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0
);

comment on table public.rate_limits is
  'Fixed-window counters for unauthenticated endpoints. Written only through rate_limit_hit(); anon holds no grants.';

create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- No policies and no grants for `anon` or `authenticated`, deliberately. The
-- definer function below is the only access path; RLS is enabled so that a
-- future grant added by accident still hits a table with no permissive policy.
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(
  p_key    text,
  p_limit  integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  -- One statement: start a fresh window if the old one has expired, otherwise
  -- increment. Doing it as an upsert rather than select-then-update is what
  -- makes it correct under concurrency — two simultaneous requests cannot both
  -- read 4 and both write 5.
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when r.window_start < now() - p_window then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start < now() - p_window then now()
          else r.window_start
        end
  returning r.count into v_count;

  -- ⚠️ **Retention, and it is a privacy control rather than housekeeping.** An
  -- expired window is reset in place, so a key seen again costs nothing — but a
  -- key seen *once* would otherwise sit here forever, and this table is
  -- ultimately a record of which callers touched the site. Pruning bounds both
  -- the row count and how long that record exists.
  --
  -- Probabilistic rather than scheduled because this deployment has no cron
  -- inside Postgres (`pg_cron` is not installed — checked), and a route handler
  -- is the wrong place to own a maintenance task. One call in a hundred pays for
  -- the rest; at any realistic sign-up rate that is far more often than a day.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
exception when others then
  -- ⚠️ Fail OPEN, and it is a deliberate choice rather than an oversight. This
  -- limiter protects a newsletter sign-up, not money or data: if the counter
  -- itself is broken, refusing every visitor is a worse outcome than briefly
  -- not limiting. A limiter in front of something costlier should fail closed.
  return true;
end;
$$;

comment on function public.rate_limit_hit(text, integer, interval) is
  'Fixed-window rate limit. Returns true if the caller may proceed. Fails open.';

revoke all on function public.rate_limit_hit(text, integer, interval) from public;
grant execute on function public.rate_limit_hit(text, integer, interval)
  to anon, authenticated, service_role;

-- ===========================================================================
-- 2. `products.status` permits a value nothing can honour
-- ===========================================================================
-- `0005`'s CHECK allows `'scheduled'`, and `products` has **no `scheduled_for`
-- column**. So a product can be put into a state that says "publish me later"
-- with nowhere to record when, and nothing to act on it: `product` is absent
-- from `SCHEDULABLE_TYPES` and from `schedulable_document_table()`, so
-- `run_due_publishes` cannot see it either.
--
-- Unreachable through the admin today, which is exactly why it is worth removing
-- rather than leaving: the next person to add a status dropdown gets a value
-- that looks supported, sets it, and the product simply never publishes. **A
-- vocabulary that promises a behaviour nothing implements is a trap with a
-- delay on it.**
--
-- Narrowing rather than adding the column, because scheduling a *product* is a
-- feature nobody has asked for and adding a column would be inventing it. If it
-- is ever wanted, it arrives with `scheduled_for`, a `SCHEDULABLE_TYPES` entry
-- and a runner change — together, as scheduled publishing did for documents.
--
-- Safe because no row uses it: verified on the live project before writing this
-- (`select count(*) from products where status = 'scheduled'` → 0), and the
-- guard below makes the migration refuse rather than corrupt if that ever
-- changes on another environment.

do $$
begin
  if exists (select 1 from public.products where status = 'scheduled') then
    raise exception
      'products.status = ''scheduled'' rows exist; decide what they mean before narrowing the CHECK';
  end if;
end $$;

alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'published', 'archived'));

-- ===========================================================================
-- 3. The media search index has never been reachable
-- ===========================================================================
-- `0002` created `media_assets_search_idx` as a GIN index over an *expression*
-- — `to_tsvector(...)` computed inline. PostgREST cannot express that in a
-- filter, so the library's search has always fallen back to `ilike` across four
-- columns, which the index cannot serve either. An index that has never been
-- used by anything, and a search that scans.
--
-- A **stored generated column** fixes both halves at once: it is a real column,
-- so PostgREST can filter on it with `fts`, and a plain GIN index over a column
-- is one the planner will actually choose.
--
-- ⚠️ The four columns are `file_name`, `title`, `alt_text` and `caption` —
-- taken from `searchFilter` in the repository rather than guessed. A first draft
-- of this migration used `description`, which **does not exist on this table**;
-- it would have failed on apply. Read the column list, not the mental model.
--
-- `coalesce` on every part because three of the four are nullable and
-- `to_tsvector` of NULL is NULL — which would silently drop the row from the
-- index rather than erroring. The weights are deliberate: the file name and
-- title are what an editor is usually reaching for, so they outrank the alt
-- text and caption when results are ranked.

alter table public.media_assets
  drop column if exists search_vector;

alter table public.media_assets
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(file_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(alt_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(caption, '')), 'C')
  ) stored;

-- The old expression index is superseded; dropping it saves the write cost of
-- maintaining an index nothing has ever read.
drop index if exists public.media_assets_search_idx;

create index if not exists media_assets_search_vector_idx
  on public.media_assets using gin (search_vector);

-- `anon` never reads media through PostgREST (public images resolve to storage
-- URLs), so the column follows the existing grants rather than adding any.
