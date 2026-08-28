-- 0024 — the newsletter finally stores an address.
--
-- ---------------------------------------------------------------------------
-- What was actually happening
-- ---------------------------------------------------------------------------
-- Both sign-up bands were demo props. `Newsletter.tsx` read the address into
-- React state and threw it away on submit; `CtaBand.tsx`'s input had no `value`
-- and no `onChange` at all, so the address was never read. Both then rendered a
-- confirmation — "Thanks — you're on the list." and "SUBSCRIBED ✓".
--
-- They render on SEVEN live pages: `/` (newsletter), all five category pages
-- (ctaBand) and `/membership` (ctaBand). Every one told a visitor they had
-- subscribed to something with no record of them anywhere.
--
-- ⚠️ `PROGRESS.md` had described this for several phases as "the newsletter
-- captures to Supabase and reaches no ESP". There was no table, no route
-- handler, no repository and no service — checked, not assumed. The backlog
-- line is what stopped anyone looking: it read as a benign half-done
-- integration rather than a false statement shown to every visitor.
--
-- ---------------------------------------------------------------------------
-- Why the RLS here is unlike every other table in this schema
-- ---------------------------------------------------------------------------
-- This is the **first table an anonymous visitor may write to.** Everything
-- else `anon` touches is read-only published content. That inverts the usual
-- shape and makes two rules load-bearing:
--
--   1. `anon` gets INSERT and **nothing else**. No SELECT, no UPDATE, no
--      DELETE — at the grant level as well as the policy level, because `0020`
--      recorded the trap: a table-level grant covers every column, and a policy
--      cannot take back a privilege the role was granted.
--   2. **A subscriber list that `anon` could read is a subscriber list that has
--      leaked.** PostgREST is a public endpoint and the publishable key ships
--      in the client bundle by design, so "the app never selects it" is not a
--      control. Only staff read this.
--
-- The insert policy is `with check (true)` deliberately: there is no session to
-- check anything against, and the value of the gate is that it is INSERT-only.
-- Column defaults do the rest — `status` cannot be forged to 'confirmed'
-- because `anon` has no INSERT grant on that column.
--
-- ---------------------------------------------------------------------------
-- Why `status` defaults to 'pending' and nothing writes 'confirmed'
-- ---------------------------------------------------------------------------
-- Nothing sends a confirmation email yet, so nobody has confirmed anything. A
-- row saying 'subscribed' would be the same untruth the button used to tell,
-- merely stored instead of rendered. Double opt-in is what moves a row to
-- 'confirmed', and it is a separate slice with a consent decision inside it.
--
-- ---------------------------------------------------------------------------
-- Uniqueness: a CHECK plus a PLAIN unique constraint, not a functional index
-- ---------------------------------------------------------------------------
-- `citext` is not installed on this project (checked: pg_extension holds
-- pgcrypto, plpgsql, uuid-ossp, supabase_vault, pg_stat_statements), so
-- case-insensitive uniqueness has to be built rather than declared.
--
-- ⚠️ **The obvious construction — `create unique index on … (lower(email))` —
-- was written first and is wrong here.** A *functional* index cannot satisfy
-- `ON CONFLICT (email)`: Postgres answers **42P10, "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification"**, so every
-- idempotent upsert fails. Found by probing the built route, not by a test.
--
-- So the normalisation is enforced by a CHECK and the uniqueness by an ordinary
-- constraint. `email = lower(email)` means no other casing can exist in the
-- table at all, which makes a plain `unique (email)` case-insensitive by
-- construction — and leaves a conflict target `ON CONFLICT` can actually use.
-- The domain lowercases on the way in; the CHECK is what makes that a property
-- of the data rather than a habit of one caller.
--
-- A repeat sign-up is then an idempotent no-op rather than a duplicate row or
-- an error, which also bounds what an abusive caller can accumulate.
--
-- ⚠️ **This is not rate limiting and does not pretend to be.** A public write
-- endpoint with no throttle can still be filled with distinct addresses.
-- Recorded in Known issues alongside `resolve_preview`, which has the same gap.
--
-- ---------------------------------------------------------------------------
-- Re-runnable
-- ---------------------------------------------------------------------------
-- `create table if not exists`, `create index if not exists`, and a
-- `drop policy if exists` before each `create policy` — Postgres has no
-- `if not exists` for a policy or a trigger. `grant`/`revoke` are idempotent.
-- The `Migrations are idempotent` CI step replays every migration onto itself.

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  -- Which block captured it. `unknown` rather than null so a later count never
  -- has to decide whether null means "unknown" or "not recorded yet".
  source      text not null default 'unknown'
                check (source in ('newsletter', 'ctaBand', 'unknown')),
  status      text not null default 'pending'
                check (status in ('pending', 'confirmed', 'unsubscribed')),
  -- Set when double opt-in lands. Null is the honest value until then.
  confirmed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'Email capture from the public sign-up bands. anon may INSERT and nothing else; only staff read it.';

-- Dropped: the functional index this migration originally carried. Kept as a
-- drop so a project that ran the first version converges on the same shape.
drop index if exists public.newsletter_subscribers_email_key;

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_email_lowercase;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_email_lowercase check (email = lower(email));

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_email_unique;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_email_unique unique (email);

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- --------------------------------------------------------------------------
-- Grants. The policy half is below; this half is what a policy cannot undo.
-- --------------------------------------------------------------------------
revoke all on public.newsletter_subscribers from anon, authenticated;

-- Exactly the three columns a visitor may supply. `status`, `confirmed_at` and
-- the timestamps are absent on purpose: without an INSERT grant on `status` a
-- forged 'confirmed' is refused by the database rather than by a Zod schema.
grant insert (id, email, source) on public.newsletter_subscribers to anon;

-- Staff read and manage through their own session. `authenticated` covers
-- signed-in accounts; the policies below decide which of them are staff.
grant select, insert, update, delete on public.newsletter_subscribers to authenticated;

-- --------------------------------------------------------------------------
-- Policies
-- --------------------------------------------------------------------------

-- Anyone may sign up. There is no session to check, and INSERT-only is the gate.
drop policy if exists "newsletter: anyone may subscribe" on public.newsletter_subscribers;
create policy "newsletter: anyone may subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

-- Reading the list is staff-only. Deliberately `is_staff()` rather than a new
-- permission: this table has no admin screen yet, and inventing
-- `newsletter.read` here would seed a permission no role holds and no UI
-- checks — the `template_assignments` shape this repo has recorded twice.
drop policy if exists "newsletter: staff read" on public.newsletter_subscribers;
create policy "newsletter: staff read" on public.newsletter_subscribers
  for select to authenticated using (public.is_staff());

drop policy if exists "newsletter: staff manage" on public.newsletter_subscribers;
create policy "newsletter: staff manage" on public.newsletter_subscribers
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "newsletter: staff delete" on public.newsletter_subscribers;
create policy "newsletter: staff delete" on public.newsletter_subscribers
  for delete to authenticated using (public.is_staff());

-- `updated_at`, on the same trigger every other table here uses. The function
-- is `touch_updated_at` and the trigger name follows `<table>_touch`, matching
-- `0001` and `0002` — checked against those files rather than guessed.
drop trigger if exists newsletter_subscribers_touch on public.newsletter_subscribers;
create trigger newsletter_subscribers_touch before update on public.newsletter_subscribers
  for each row execute function public.touch_updated_at();
