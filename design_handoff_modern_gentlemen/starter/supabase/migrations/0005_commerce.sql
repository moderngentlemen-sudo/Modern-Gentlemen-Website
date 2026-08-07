-- 0005 — Commerce: one product model, three origins.
--
-- `product_sources` records where a product came from — hand entry, an XML
-- feed, or a Shopify store — so every row is traceable to its provider and a
-- sync can reconcile only what it owns. XML and Shopify are adapters behind the
-- same interface, so they share this table and the ingestion pipeline in 0006.
--
-- Money is INTEGER PENCE, matching lib/domain/money.ts. The original scaffold
-- used numeric(10,2) pounds; pence was chosen instead because a 15% member
-- discount on £145 is £21.75 and only exact integer arithmetic reproduces that
-- reliably. Converters live at the boundary, never in the schema.
--
-- Credentials are NOT stored here. `credentials_ref` names an environment
-- variable; the adapter resolves it at run time. A database dump therefore
-- never carries a live merchant token.

create table if not exists public.product_sources (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('native','xml_feed','shopify')),
  name            text not null,
  enabled         boolean not null default true,
  config          jsonb not null default '{}'::jsonb,
  credentials_ref text,
  sync_schedule   text,
  last_synced_at  timestamptz,
  last_status     text check (last_status in ('ok','partial','failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.product_collections (
  id       uuid primary key default gen_random_uuid(),
  slug     text unique not null,
  name     text not null,
  description text,
  position integer not null default 0,
  status   text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  source_id     uuid references public.product_sources(id) on delete set null,
  -- The provider's own identifier, used for dedupe and change detection.
  external_id   text,

  fulfilment    text not null default 'direct' check (fulfilment in ('direct','affiliate')),

  name          text not null,
  cat           text,
  cat_label     text,
  sku           text,
  blurb         text,
  story         text,
  material      text,

  price_pence        integer not null default 0,
  compare_at_pence   integer,
  currency           text not null default 'GBP',

  stock            integer not null default 0,
  track_inventory  boolean not null default true,
  availability     text not null default 'in_stock'
                     check (availability in ('in_stock','out_of_stock','preorder','discontinued')),

  badges        text[] not null default '{}',
  specs         jsonb  not null default '[]'::jsonb,

  -- Affiliate-only fields. Kept in one typed object rather than six mostly-null
  -- columns; the Zod schema in lib/domain enforces its shape.
  --   { merchant_name, merchant_url, disclosure, external_price_pence }
  affiliate     jsonb not null default '{}'::jsonb,

  position      integer not null default 0,

  status        text not null default 'draft'
                  check (status in ('draft','published','scheduled','archived')),
  draft_data     jsonb not null default '{"sections":[],"seo":{}}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,

  -- Hash of the normalised source payload; lets a sync skip unchanged rows.
  content_hash  text,

  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint affiliate_needs_merchant_url check (
    fulfilment <> 'affiliate' or affiliate ? 'merchant_url'
  )
);

-- One row per provider product: the dedupe key the ingestion pipeline relies on.
create unique index if not exists products_source_external_uniq
  on public.products(source_id, external_id)
  where external_id is not null;

create index if not exists products_status_idx     on public.products(status);
create index if not exists products_cat_idx        on public.products(cat);
create index if not exists products_source_idx     on public.products(source_id);
create index if not exists products_fulfilment_idx on public.products(fulfilment);
create index if not exists products_search_idx on public.products
  using gin (to_tsvector('english',
    coalesce(name,'') || ' ' || coalesce(blurb,'') || ' ' || coalesce(sku,'')));

create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  external_id   text,
  title         text not null,
  sku           text,
  options       jsonb not null default '{}'::jsonb,
  price_pence   integer,
  stock         integer not null default 0,
  availability  text not null default 'in_stock'
                  check (availability in ('in_stock','out_of_stock','preorder','discontinued')),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants(product_id);

create table if not exists public.product_media (
  product_id uuid not null references public.products(id) on delete cascade,
  asset_id   uuid not null references public.media_assets(id) on delete cascade,
  position   integer not null default 0,
  role       text not null default 'gallery' check (role in ('primary','gallery','swatch')),
  primary key (product_id, asset_id)
);

create table if not exists public.product_collection_items (
  collection_id uuid not null references public.product_collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, product_id)
);

drop trigger if exists product_sources_touch on public.product_sources;
create trigger product_sources_touch before update on public.product_sources
  for each row execute function public.touch_updated_at();
drop trigger if exists product_collections_touch on public.product_collections;
create trigger product_collections_touch before update on public.product_collections
  for each row execute function public.touch_updated_at();
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();

alter table public.product_sources          enable row level security;
alter table public.product_collections      enable row level security;
alter table public.products                 enable row level security;
alter table public.product_variants         enable row level security;
alter table public.product_media            enable row level security;
alter table public.product_collection_items enable row level security;

-- Sources may carry provider detail; staff only.
drop policy if exists "product_sources: staff read" on public.product_sources;
create policy "product_sources: staff read" on public.product_sources
  for select using (public.is_staff());
drop policy if exists "product_sources: write" on public.product_sources;
create policy "product_sources: write" on public.product_sources for all
  using (public.has_permission('integration.write'))
  with check (public.has_permission('integration.write'));

drop policy if exists "product_collections: public read published" on public.product_collections;
create policy "product_collections: public read published" on public.product_collections
  for select using (status = 'published' or public.is_staff());
drop policy if exists "product_collections: write" on public.product_collections;
create policy "product_collections: write" on public.product_collections for all
  using (public.has_permission('product.write'))
  with check (public.has_permission('product.write'));

drop policy if exists "products: public read published" on public.products;
create policy "products: public read published" on public.products
  for select using (status = 'published' or public.is_staff());
drop policy if exists "products: write" on public.products;
create policy "products: write" on public.products for all
  using (public.has_permission('product.write'))
  with check (public.has_permission('product.write'));
drop policy if exists "products: delete" on public.products;
create policy "products: delete" on public.products
  for delete using (public.has_permission('product.delete'));

drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (true);
drop policy if exists "product_variants: write" on public.product_variants;
create policy "product_variants: write" on public.product_variants for all
  using (public.has_permission('product.write'))
  with check (public.has_permission('product.write'));

drop policy if exists "product_media: public read" on public.product_media;
create policy "product_media: public read" on public.product_media for select using (true);
drop policy if exists "product_media: write" on public.product_media;
create policy "product_media: write" on public.product_media for all
  using (public.has_permission('product.write'))
  with check (public.has_permission('product.write'));

drop policy if exists "product_collection_items: public read" on public.product_collection_items;
create policy "product_collection_items: public read" on public.product_collection_items
  for select using (true);
drop policy if exists "product_collection_items: write" on public.product_collection_items;
create policy "product_collection_items: write" on public.product_collection_items for all
  using (public.has_permission('product.write'))
  with check (public.has_permission('product.write'));

-- The house catalogue is itself a source, so hand-entered products are
-- traceable in exactly the same way as imported ones.
insert into public.product_sources (kind, name, enabled)
select 'native', 'Modern Gentlemen (native)', true
where not exists (select 1 from public.product_sources where kind = 'native');
