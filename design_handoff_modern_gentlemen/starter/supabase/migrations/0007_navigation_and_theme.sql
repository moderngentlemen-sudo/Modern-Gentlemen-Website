-- 0007 — Navigation and the theme/design-token system.
--
-- Menu items are self-referencing so nesting needs no depth limit in the
-- schema, and link targets are polymorphic (page/article/category/product/URL)
-- so a menu entry follows its target's slug instead of freezing a path.
--
-- theme_settings is a single versioned document. Its `tokens` object mirrors
-- the CSS custom properties in app/globals.css; the renderer emits them as a
-- :root style block, which is what lets an editor change global design without
-- touching code. Local overrides live on individual blocks.

create table if not exists public.menus (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  -- Where the menu is mounted: 'header-primary', 'footer-secondary', ...
  location    text,
  status      text not null default 'draft'
                check (status in ('draft','published','archived')),
  version     integer not null default 0,
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references public.menus(id) on delete cascade,
  parent_id   uuid references public.menu_items(id) on delete cascade,
  label       text not null,
  link_type   text not null default 'url'
                check (link_type in ('page','article','category','product','collection','url')),
  target_id   uuid,
  url         text,
  -- Rendering extras: icons, CTA styling, mega-menu grouping.
  options     jsonb not null default '{}'::jsonb,
  -- { auth: 'any'|'in'|'out', member: bool|null, devices: [...] }
  visibility  jsonb not null default '{}'::jsonb,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint menu_item_target_shape check (
    (link_type = 'url' and url is not null) or
    (link_type <> 'url' and target_id is not null)
  )
);

create index if not exists menu_items_menu_idx   on public.menu_items(menu_id, position);
create index if not exists menu_items_parent_idx on public.menu_items(parent_id);

create table if not exists public.theme_settings (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null default 'default',
  name           text not null default 'Site theme',
  status         text not null default 'draft'
                   check (status in ('draft','published','archived')),
  -- { colors:{}, typography:{}, spacing:{}, radius:{}, shadows:{},
  --   buttons:{}, cards:{}, forms:{}, layout:{}, animation:{} }
  draft_data     jsonb not null default '{}'::jsonb,
  published_data jsonb,
  version        integer not null default 0,
  published_at   timestamptz,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Site-wide settings that are not design tokens: SEO defaults, social,
-- announcement bar, feature flags. Namespaced so modules can own a key.
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger menus_touch          before update on public.menus
  for each row execute function public.touch_updated_at();
create trigger menu_items_touch     before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger theme_settings_touch before update on public.theme_settings
  for each row execute function public.touch_updated_at();
create trigger site_settings_touch  before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.menus          enable row level security;
alter table public.menu_items     enable row level security;
alter table public.theme_settings enable row level security;
alter table public.site_settings  enable row level security;

create policy "menus: public read published" on public.menus
  for select using (status = 'published' or public.is_staff());
create policy "menus: write" on public.menus for all
  using (public.has_permission('navigation.write'))
  with check (public.has_permission('navigation.write'));

create policy "menu_items: public read" on public.menu_items for select using (true);
create policy "menu_items: write" on public.menu_items for all
  using (public.has_permission('navigation.write'))
  with check (public.has_permission('navigation.write'));

create policy "theme_settings: public read" on public.theme_settings
  for select using (true);
create policy "theme_settings: write" on public.theme_settings for all
  using (public.has_permission('theme.write'))
  with check (public.has_permission('theme.write'));

create policy "site_settings: public read" on public.site_settings for select using (true);
create policy "site_settings: write" on public.site_settings for all
  using (public.has_permission('settings.write'))
  with check (public.has_permission('settings.write'));

insert into public.theme_settings (key, name, status) values ('default', 'Site theme', 'published')
on conflict (key) do nothing;

insert into public.menus (key, name, location, status) values
  ('header-primary', 'Header — primary', 'header-primary', 'published'),
  ('footer-primary', 'Footer — primary', 'footer-primary', 'published')
on conflict (key) do nothing;
