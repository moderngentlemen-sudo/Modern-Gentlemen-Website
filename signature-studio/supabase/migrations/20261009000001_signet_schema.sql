-- Signet (Signature Studio) — accounts, cloud sync, short card links, image hosting.
-- For the NEW, separate Signet Supabase project only. Never apply this to the
-- Modern Gentlemen website's database.
--
-- Re-runnable: every table/index uses IF NOT EXISTS and every policy/trigger is
-- dropped before it is created (Postgres has no IF NOT EXISTS for either).

-- ---------------------------------------------------------------------------
-- Profiles: one row per account, created by a trigger on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  -- Billing will set this from a server; users can never write it (see grants).
  plan text not null default 'free' check (plan in ('free', 'pro', 'teams')),
  -- Synced preferences: saved contact profile, brand kit, my templates, favourites.
  prefs jsonb not null default '{}'::jsonb check (pg_column_size(prefs) < 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Column-level: users may change their name and preferences, never their plan.
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (display_name, prefs) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only ever runs as the sign-up trigger; not callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Signatures: the whole document as JSON, one row per signature.
-- `revision` gives optimistic concurrency: a client updates only when the
-- revision it last saw is still current, so two devices never silently
-- overwrite each other. Deletes are soft (tombstones) so other devices learn
-- about them.
-- ---------------------------------------------------------------------------
create table if not exists public.signatures (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  doc jsonb not null check (pg_column_size(doc) < 2000000),
  revision integer not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create index if not exists signatures_owner_updated on public.signatures (owner, updated_at desc);

alter table public.signatures enable row level security;

drop policy if exists "signatures: read own" on public.signatures;
create policy "signatures: read own" on public.signatures for select to authenticated using (owner = (select auth.uid()));

drop policy if exists "signatures: insert own" on public.signatures;
create policy "signatures: insert own" on public.signatures for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "signatures: update own" on public.signatures;
create policy "signatures: update own" on public.signatures for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "signatures: delete own" on public.signatures;
create policy "signatures: delete own" on public.signatures for delete to authenticated using (owner = (select auth.uid()));

grant select, insert, update, delete on public.signatures to authenticated;

-- Every update bumps the revision and timestamp server-side, whatever the client sends.
create or replace function public.bump_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.owner := old.owner;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists signatures_bump_revision on public.signatures;
create trigger signatures_bump_revision before update on public.signatures
  for each row execute function public.bump_revision();

-- ---------------------------------------------------------------------------
-- Digital cards behind short links (/c/<slug>). Anyone can read a card —
-- that's the point of sharing it — but only its owner can write it. Editing
-- the card updates what the same link shows.
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$'),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  signature_id text,
  data jsonb not null check (pg_column_size(data) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_owner on public.cards (owner);
create unique index if not exists cards_owner_signature on public.cards (owner, signature_id) where signature_id is not null;

alter table public.cards enable row level security;

drop policy if exists "cards: public read" on public.cards;
create policy "cards: public read" on public.cards for select to anon, authenticated using (true);

drop policy if exists "cards: insert own" on public.cards;
create policy "cards: insert own" on public.cards for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "cards: update own" on public.cards;
create policy "cards: update own" on public.cards for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "cards: delete own" on public.cards;
create policy "cards: delete own" on public.cards for delete to authenticated using (owner = (select auth.uid()));

-- Public readers see only the slug and the card itself, never who owns it.
revoke select on public.cards from anon;
grant select (slug, data, updated_at) on public.cards to anon;
grant select, insert, update, delete on public.cards to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Image hosting: a public-read bucket. Each user uploads only under their
-- own folder (<user id>/s/<sha256>.png). Objects are content-addressed and
-- immutable — no updates — so a URL in a sent email never changes under it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signet-images', 'signet-images', true, 5242880, array['image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "signet-images: upload own folder" on storage.objects;
create policy "signet-images: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'signet-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "signet-images: read own" on storage.objects;
create policy "signet-images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'signet-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Named "remove own" (it was created under this name on the live project, and
-- Supabase owns storage.objects, so it can't be renamed there).
drop policy if exists "signet-images: delete own" on storage.objects;
drop policy if exists "signet-images: remove own" on storage.objects;
create policy "signet-images: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'signet-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Delete my account: removes the login, which cascades to the profile,
-- signatures and cards. The app empties the user's image folder first
-- (storage objects can only be removed through the Storage API).
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
