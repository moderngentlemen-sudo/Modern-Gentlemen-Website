-- Modern Gentlemen — initial Supabase schema
-- Single backend for content, products, users/members, orders, newsletter, cart sync.
-- Run against a Supabase Postgres project (SQL editor or `supabase db push`).
-- Payments are handled by Stripe; paid orders are written here by the Stripe webhook.
--
-- Conventions:
--   * money is numeric(10,2) in GBP pounds — matching starter/lib/catalog.ts
--     (product price 145.00, shipping 4.95, 15% member discount). If you prefer
--     integer pence, change it here AND in the app's money helpers together.
--   * every table has Row Level Security (RLS) enabled with explicit policies.
--   * `is_admin()` gates all content/product writes.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ===========================================================================
-- PROFILES  (1:1 with auth.users) — membership + role live here
-- ===========================================================================
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text,
  is_member          boolean not null default false,   -- drives the 15% member discount
  member_since       timestamptz,
  stripe_customer_id text,
  role               text not null default 'user' check (role in ('user','admin')),
  created_at         timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: self read"   on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles: self update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = 'user');   -- users cannot self-promote to admin

-- ===========================================================================
-- PRODUCTS  (ports mg-catalog.js — the 16-product catalog)
-- ===========================================================================
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  cat         text not null,                    -- 'Style' | 'Watches' | 'Grooming' | 'Accessories'
  cat_label   text not null,
  name        text not null,
  price       numeric(10,2) not null,           -- GBP pounds (matches lib/catalog.ts)
  tag         text default '',                  -- 'NEW' | 'BESTSELLER' | 'LIMITED' | ''
  material    text,
  blurb       text,
  story       text,                             -- \n\n-split paragraphs
  specs       jsonb not null default '[]'::jsonb,   -- [[key,value], ...]
  images      text[] not null default '{}',     -- storage paths or URLs (3 each)
  stock       integer not null default 100,
  position    integer not null default 0,       -- display order
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists products_cat_idx on public.products(cat);

alter table public.products enable row level security;
create policy "products: public read"  on public.products for select using (published or public.is_admin());
create policy "products: admin write"  on public.products for all    using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- CONTENT  (replaces Sanity) — pages, articles, categories
--   pages.sections is the ordered Block[] the existing <SectionRenderer/> consumes.
-- ===========================================================================
create table if not exists public.pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,            -- 'home', 'about', ...
  title        text not null,
  seo          jsonb not null default '{}'::jsonb,   -- { title, description, ogImage }
  sections     jsonb not null default '[]'::jsonb,   -- [{ _key, _type, ...props }]
  published    boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,            -- style|grooming|watches|culture|film
  name         text not null,
  intro        text,
  hero         jsonb not null default '{}'::jsonb,
  sections     jsonb not null default '[]'::jsonb,
  published    boolean not null default true
);

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  template     text not null default 'feature', -- article hero/body template enum
  category     text,                            -- fk-ish to categories.slug
  hero         jsonb not null default '{}'::jsonb,
  body         jsonb not null default '[]'::jsonb,   -- portable rich-text blocks
  seo          jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published    boolean not null default false
);
create index if not exists articles_category_idx on public.articles(category);

alter table public.pages      enable row level security;
alter table public.categories enable row level security;
alter table public.articles   enable row level security;

create policy "pages: public read"       on public.pages      for select using (published or public.is_admin());
create policy "pages: admin write"       on public.pages      for all    using (public.is_admin()) with check (public.is_admin());
create policy "categories: public read"  on public.categories for select using (published or public.is_admin());
create policy "categories: admin write"  on public.categories for all    using (public.is_admin()) with check (public.is_admin());
create policy "articles: public read"    on public.articles   for select using (published or public.is_admin());
create policy "articles: admin write"    on public.articles   for all    using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- CARTS  (cross-device sync for logged-in users; guests use localStorage)
-- ===========================================================================
create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  unique (user_id)
);
create table if not exists public.cart_items (
  cart_id     uuid not null references public.carts(id) on delete cascade,
  product_slug text not null,
  qty         integer not null check (qty > 0),
  primary key (cart_id, product_slug)
);

alter table public.carts      enable row level security;
alter table public.cart_items enable row level security;
create policy "carts: owner"      on public.carts      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cart_items: owner" on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- ===========================================================================
-- ORDERS  (written by the Stripe webhook via the service-role key)
-- ===========================================================================
create table if not exists public.orders (
  id              text primary key,             -- 'MG-XXXXXX'
  user_id         uuid references auth.users(id) on delete set null,
  email           text not null,
  status          text not null default 'pending'
                    check (status in ('pending','paid','fulfilled','cancelled','refunded')),
  subtotal        numeric(10,2) not null,        -- GBP pounds
  discount        numeric(10,2) not null default 0,
  shipping        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  stripe_session_id       text,
  stripe_payment_intent   text,
  shipping_address jsonb,
  created_at      timestamptz not null default now()
);
create table if not exists public.order_items (
  order_id      text not null references public.orders(id) on delete cascade,
  product_slug  text not null,
  name          text not null,
  unit_price    numeric(10,2) not null,          -- GBP pounds, at time of order
  qty           integer not null check (qty > 0),
  line_total    numeric(10,2) not null,
  primary key (order_id, product_slug)
);
create index if not exists orders_user_idx on public.orders(user_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
-- Users can read their own orders; all writes happen server-side with the
-- service-role key (which bypasses RLS), so there is no client insert policy.
create policy "orders: owner read"      on public.orders      for select using (auth.uid() = user_id or public.is_admin());
create policy "order_items: owner read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- ===========================================================================
-- NEWSLETTER
-- ===========================================================================
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  source      text default 'site',
  created_at  timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
-- Anonymous signups are allowed to INSERT (email only); reads are admin-only.
create policy "newsletter: anyone insert" on public.newsletter_subscribers for insert with check (true);
create policy "newsletter: admin read"    on public.newsletter_subscribers for select using (public.is_admin());
