-- 0003 — Templates, patterns, pages: the content spine the builder edits.
--
-- Versioning convention, used by every editable entity from here on:
--   draft_data      the payload the builder writes on autosave
--   published_data  the payload the public site reads (NULL until first publish)
--   version         increments on publish; revisions row is written at the same time
--   status          draft | published | scheduled | archived
-- Query-critical fields (slug, kind, status) stay real columns so they can be
-- indexed and filtered; the editable tree lives in jsonb.
--
-- Block tree shape (both draft_data and published_data):
--   { "sections": BlockNode[], "seo": {...} }
--   BlockNode = { _key, _type, settings, children?, visibility?, locked?, _ref? }
-- A node with `_ref` points at a pattern and is expanded at render time.

-- ---------------------------------------------------------------------------
-- TEMPLATES — page/article/product/archive layouts plus global header/footer
-- ---------------------------------------------------------------------------
create table if not exists public.templates (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,
  kind           text not null check (kind in
                   ('page','article','product','archive','header','footer','section')),
  name           text not null,
  description    text,
  -- Global parts (header/footer) are shared across the whole site; locking one
  -- makes the builder require an explicit unlock before editing.
  is_global      boolean not null default false,
  locked         boolean not null default false,

  status         text not null default 'draft'
                   check (status in ('draft','published','scheduled','archived')),
  draft_data     jsonb not null default '{"areas":{}}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,

  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists templates_kind_idx   on public.templates(kind);
create index if not exists templates_status_idx on public.templates(status);

-- Resolution order, most specific first: entry > taxonomy > content_type.
create table if not exists public.template_assignments (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates(id) on delete cascade,
  scope        text not null check (scope in ('content_type','taxonomy','entry')),
  content_type text,
  taxonomy_slug text,
  entry_id     uuid,
  priority     integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint template_assignment_scope_shape check (
    (scope = 'content_type' and content_type is not null and taxonomy_slug is null and entry_id is null) or
    (scope = 'taxonomy'     and content_type is not null and taxonomy_slug is not null and entry_id is null) or
    (scope = 'entry'        and entry_id is not null)
  )
);

create unique index if not exists template_assignment_content_type_uniq
  on public.template_assignments(content_type) where scope = 'content_type';
create unique index if not exists template_assignment_taxonomy_uniq
  on public.template_assignments(content_type, taxonomy_slug) where scope = 'taxonomy';
create unique index if not exists template_assignment_entry_uniq
  on public.template_assignments(entry_id) where scope = 'entry';

-- ---------------------------------------------------------------------------
-- PATTERNS — reusable sections and saved layouts
--   synced      edits propagate to every usage (WordPress "reusable block")
--   detachable  inserted as a copy the editor can then diverge from
-- ---------------------------------------------------------------------------
create table if not exists public.pattern_categories (
  id    uuid primary key default gen_random_uuid(),
  slug  text unique not null,
  label text not null,
  position integer not null default 0
);

create table if not exists public.patterns (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,
  name           text not null,
  description    text,
  category_id    uuid references public.pattern_categories(id) on delete set null,
  sync_mode      text not null default 'detachable'
                   check (sync_mode in ('synced','detachable')),
  preview_asset_id uuid references public.media_assets(id) on delete set null,

  status         text not null default 'draft'
                   check (status in ('draft','published','archived')),
  draft_data     jsonb not null default '{"blocks":[]}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,

  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists patterns_category_idx on public.patterns(category_id);
create index if not exists patterns_status_idx   on public.patterns(status);

-- ---------------------------------------------------------------------------
-- PAGES
-- ---------------------------------------------------------------------------
create table if not exists public.pages (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  template_id    uuid references public.templates(id) on delete set null,
  -- Home and other structural pages cannot be deleted from the admin.
  is_system      boolean not null default false,

  status         text not null default 'draft'
                   check (status in ('draft','published','scheduled','archived')),
  draft_data     jsonb not null default '{"sections":[],"seo":{}}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,
  scheduled_for  timestamptz,

  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists pages_status_idx    on public.pages(status);
create index if not exists pages_template_idx  on public.pages(template_id);
create index if not exists pages_scheduled_idx on public.pages(scheduled_for)
  where status = 'scheduled';

-- Slugs change; links should not rot.
create table if not exists public.redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text unique not null,
  to_path     text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  created_at  timestamptz not null default now()
);

drop trigger if exists templates_touch on public.templates;
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();
drop trigger if exists patterns_touch on public.patterns;
create trigger patterns_touch  before update on public.patterns
  for each row execute function public.touch_updated_at();
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch     before update on public.pages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — anonymous readers see published rows only; the draft payload is never
-- exposed to them because the public loaders select published_data explicitly
-- and these policies gate the row itself.
-- ---------------------------------------------------------------------------
alter table public.templates            enable row level security;
alter table public.template_assignments enable row level security;
alter table public.pattern_categories   enable row level security;
alter table public.patterns             enable row level security;
alter table public.pages                enable row level security;
alter table public.redirects            enable row level security;

drop policy if exists "templates: public read published" on public.templates;
create policy "templates: public read published" on public.templates
  for select using (status = 'published' or public.is_staff());
drop policy if exists "templates: write" on public.templates;
create policy "templates: write" on public.templates
  for all using (public.has_permission('template.write'))
  with check (public.has_permission('template.write'));

drop policy if exists "template_assignments: public read" on public.template_assignments;
create policy "template_assignments: public read" on public.template_assignments
  for select using (true);
drop policy if exists "template_assignments: write" on public.template_assignments;
create policy "template_assignments: write" on public.template_assignments
  for all using (public.has_permission('template.write'))
  with check (public.has_permission('template.write'));

drop policy if exists "pattern_categories: public read" on public.pattern_categories;
create policy "pattern_categories: public read" on public.pattern_categories
  for select using (true);
drop policy if exists "pattern_categories: write" on public.pattern_categories;
create policy "pattern_categories: write" on public.pattern_categories
  for all using (public.has_permission('pattern.write'))
  with check (public.has_permission('pattern.write'));

drop policy if exists "patterns: public read published" on public.patterns;
create policy "patterns: public read published" on public.patterns
  for select using (status = 'published' or public.is_staff());
drop policy if exists "patterns: write" on public.patterns;
create policy "patterns: write" on public.patterns
  for all using (public.has_permission('pattern.write'))
  with check (public.has_permission('pattern.write'));

drop policy if exists "pages: public read published" on public.pages;
create policy "pages: public read published" on public.pages
  for select using (status = 'published' or public.is_staff());
drop policy if exists "pages: write" on public.pages;
create policy "pages: write" on public.pages
  for all using (public.has_permission('page.write'))
  with check (public.has_permission('page.write'));
drop policy if exists "pages: delete" on public.pages;
create policy "pages: delete" on public.pages
  for delete using (public.has_permission('page.delete') and not is_system);

drop policy if exists "redirects: public read" on public.redirects;
create policy "redirects: public read" on public.redirects
  for select using (true);
drop policy if exists "redirects: write" on public.redirects;
create policy "redirects: write" on public.redirects
  for all using (public.has_permission('page.write'))
  with check (public.has_permission('page.write'));

insert into public.pattern_categories (slug, label, position) values
  ('hero', 'Heroes', 0),
  ('editorial', 'Editorial', 1),
  ('commerce', 'Commerce', 2),
  ('bands', 'Bands & CTAs', 3),
  ('saved-layouts', 'Saved layouts', 4)
on conflict (slug) do nothing;
