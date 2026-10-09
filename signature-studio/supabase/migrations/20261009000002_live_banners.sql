-- Live banners and opt-in click counts (audit Batch 5).
-- Re-runnable: every policy is dropped before it is created.
--
-- A live banner is a banner slot whose picture and link change on a schedule
-- (or rotate daily) after the signature is installed. Emails point at the
-- public `banner` edge function, which reads this table with the service role.

create table if not exists public.live_banners (
  slug text primary key check (slug ~ '^[a-z0-9]{8,24}$'),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  signature_id text not null,
  block_id text not null,
  mode text not null default 'schedule' check (mode in ('schedule', 'rotate')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 12),
  fallback jsonb not null,
  -- Count clicks (slug, which banner, when). Off unless the owner turns it on.
  track boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists live_banners_owner on public.live_banners (owner);

alter table public.live_banners enable row level security;

drop policy if exists "live_banners: read own" on public.live_banners;
create policy "live_banners: read own" on public.live_banners for select to authenticated using (owner = (select auth.uid()));

drop policy if exists "live_banners: insert own" on public.live_banners;
create policy "live_banners: insert own" on public.live_banners for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "live_banners: update own" on public.live_banners;
create policy "live_banners: update own" on public.live_banners for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "live_banners: delete own" on public.live_banners;
create policy "live_banners: delete own" on public.live_banners for delete to authenticated using (owner = (select auth.uid()));

drop trigger if exists live_banners_touch on public.live_banners;
create trigger live_banners_touch before update on public.live_banners
  for each row execute function public.touch_updated_at();

-- Clicks: no IP address, no user agent, nothing about the person clicking.
create table if not exists public.banner_clicks (
  id bigint generated always as identity primary key,
  slug text not null references public.live_banners (slug) on delete cascade,
  item integer not null,
  at timestamptz not null default now()
);

create index if not exists banner_clicks_slug_at on public.banner_clicks (slug, at);

alter table public.banner_clicks enable row level security;

-- Owners read their own banners' counts. Nobody but the edge function (service role) writes.
drop policy if exists "banner_clicks: read own" on public.banner_clicks;
create policy "banner_clicks: read own" on public.banner_clicks for select to authenticated
  using (exists (select 1 from public.live_banners b where b.slug = banner_clicks.slug and b.owner = (select auth.uid())));

revoke all on public.live_banners from anon;
revoke all on public.banner_clicks from anon;
grant select, insert, update, delete on public.live_banners to authenticated;
revoke insert, update, delete on public.banner_clicks from authenticated;
grant select on public.banner_clicks to authenticated;
