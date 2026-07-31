-- 0002 — Media library
--
-- Assets live in Supabase Storage; this schema is the catalogue over them.
--
-- `media_usages` is the piece that makes the library part of the platform
-- rather than a folder of files: on every content save, MediaUsageService walks
-- the block tree, extracts asset references, and reconciles this table. That
-- turns "where is this image used?" into a query, and makes deleting an in-use
-- asset a decision the editor makes with the facts in front of them.

create table if not exists public.media_folders (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.media_folders(id) on delete cascade,
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (parent_id, slug)
);

create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  folder_id     uuid references public.media_folders(id) on delete set null,

  -- Storage coordinates. `storage_path` is the object key within `bucket`.
  bucket        text not null default 'media',
  storage_path  text not null,
  -- Set for assets that are not stored by us (legacy /public files, embeds).
  external_url  text,

  kind          text not null check (kind in ('image', 'video', 'gif', 'audio', 'document')),
  mime_type     text not null,
  file_name     text not null,
  byte_size     bigint not null default 0,

  -- Intrinsic dimensions, so the builder can reserve space without a fetch.
  width         integer,
  height        integer,
  duration_ms   integer,
  -- Tiny inline placeholder (data URI) for blur-up loading.
  placeholder   text,

  -- Editorial metadata.
  title         text,
  alt_text      text,
  caption       text,
  credit        text,
  focal_point   jsonb not null default '{"x":0.5,"y":0.5}'::jsonb,

  -- Deduplication: identical uploads resolve to the same asset.
  checksum      text,

  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (bucket, storage_path)
);

create index if not exists media_assets_kind_idx      on public.media_assets(kind);
create index if not exists media_assets_folder_idx    on public.media_assets(folder_id);
create index if not exists media_assets_checksum_idx  on public.media_assets(checksum);
create index if not exists media_assets_created_idx   on public.media_assets(created_at desc);

-- Free-text search over the fields editors actually search by.
create index if not exists media_assets_search_idx on public.media_assets
  using gin (to_tsvector('english',
    coalesce(title, '') || ' ' || coalesce(file_name, '') || ' ' ||
    coalesce(alt_text, '') || ' ' || coalesce(caption, '')));

create table if not exists public.media_tags (
  id     uuid primary key default gen_random_uuid(),
  slug   text unique not null,
  label  text not null
);

create table if not exists public.media_asset_tags (
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  tag_id   uuid not null references public.media_tags(id)   on delete cascade,
  primary key (asset_id, tag_id)
);

-- Reconciled by MediaUsageService on save. `entity_type` is polymorphic rather
-- than a set of nullable FKs so new content types need no schema change.
create table if not exists public.media_usages (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.media_assets(id) on delete cascade,
  entity_type  text not null,   -- 'page' | 'article' | 'product' | 'template' | ...
  entity_id    uuid not null,
  -- Where in the entity: a block key, or a field path such as 'hero.media'.
  field_path   text,
  created_at   timestamptz not null default now(),
  unique (asset_id, entity_type, entity_id, field_path)
);

create index if not exists media_usages_asset_idx  on public.media_usages(asset_id);
create index if not exists media_usages_entity_idx on public.media_usages(entity_type, entity_id);

create trigger media_folders_touch before update on public.media_folders
  for each row execute function public.touch_updated_at();
create trigger media_assets_touch before update on public.media_assets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.media_folders    enable row level security;
alter table public.media_assets     enable row level security;
alter table public.media_tags       enable row level security;
alter table public.media_asset_tags enable row level security;
alter table public.media_usages     enable row level security;

-- Assets referenced by published content must be readable anonymously, and
-- storage itself is the access boundary for the bytes. The catalogue rows are
-- public-read; only staff can write.
create policy "media_assets: public read" on public.media_assets
  for select using (true);
create policy "media_assets: write" on public.media_assets
  for all using (public.has_permission('media.write'))
  with check (public.has_permission('media.write'));
create policy "media_assets: delete" on public.media_assets
  for delete using (public.has_permission('media.delete'));

create policy "media_folders: public read" on public.media_folders
  for select using (true);
create policy "media_folders: write" on public.media_folders
  for all using (public.has_permission('media.write'))
  with check (public.has_permission('media.write'));

create policy "media_tags: public read" on public.media_tags
  for select using (true);
create policy "media_tags: write" on public.media_tags
  for all using (public.has_permission('media.write'))
  with check (public.has_permission('media.write'));

create policy "media_asset_tags: public read" on public.media_asset_tags
  for select using (true);
create policy "media_asset_tags: write" on public.media_asset_tags
  for all using (public.has_permission('media.write'))
  with check (public.has_permission('media.write'));

-- Usage records are an admin concern only.
create policy "media_usages: staff read" on public.media_usages
  for select using (public.is_staff());
create policy "media_usages: write" on public.media_usages
  for all using (public.has_permission('media.write'))
  with check (public.has_permission('media.write'));
