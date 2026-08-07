-- 0001 — Identity, roles and permissions
--
-- Authorisation is enforced at three layers: RLS policies here, a
-- requirePermission() guard in lib/services, and permission-filtered admin UI.
-- This file is the deepest of the three and the one that cannot be bypassed by
-- a bug in application code.
--
-- Permissions are `resource.action` strings held in a table rather than an enum
-- on `profiles`, so a new capability is a row — not a schema migration and a
-- redeploy.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Every versioned table carries updated_at; one trigger function serves them all.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text,
  avatar_url         text,
  -- Membership drives the 15% member discount (CLAUDE.md).
  is_member          boolean not null default false,
  member_since       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ROLES & PERMISSIONS
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  key         text primary key,               -- 'admin' | 'editor' | ...
  label       text not null,
  description text,
  -- Built-in roles cannot be deleted through the admin UI.
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.permissions (
  key         text primary key,               -- 'page.publish'
  resource    text not null,                  -- 'page'
  action      text not null,                  -- 'publish'
  description text
);

create table if not exists public.role_permissions (
  role_key       text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table if not exists public.user_roles (
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_key    text not null references public.roles(key) on delete cascade,
  granted_by  uuid references auth.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_key)
);

create index if not exists user_roles_user_idx on public.user_roles(user_id);

-- ---------------------------------------------------------------------------
-- Authorisation functions
--
-- SECURITY DEFINER + a pinned search_path so they can read the permission
-- tables from inside an RLS policy without recursing into that policy.
-- ---------------------------------------------------------------------------
create or replace function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = auth.uid()
      and rp.permission_key = permission
  );
$$;

-- Retained for compatibility with the original scaffold and as a coarse check.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key = 'admin'
  );
$$;

-- Any admin-area access at all. Used to gate "read unpublished" everywhere.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- New auth users get a profile automatically.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles       enable row level security;

drop policy if exists "profiles: read own or staff" on public.profiles;
create policy "profiles: read own or staff" on public.profiles
  for select using (auth.uid() = id or public.is_staff());

-- A user may edit their own profile. Note there is no role column here to
-- escalate: roles live in user_roles, which users cannot write at all.
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles: admin manage" on public.profiles;
create policy "profiles: admin manage" on public.profiles
  for all using (public.has_permission('user.write'))
  with check (public.has_permission('user.write'));

-- Roles and permissions are readable by staff (the admin UI needs them to
-- filter navigation) and writable only with user.write.
drop policy if exists "roles: staff read" on public.roles;
create policy "roles: staff read" on public.roles
  for select using (public.is_staff());
drop policy if exists "roles: admin write" on public.roles;
create policy "roles: admin write" on public.roles
  for all using (public.has_permission('user.write'))
  with check (public.has_permission('user.write'));

drop policy if exists "permissions: staff read" on public.permissions;
create policy "permissions: staff read" on public.permissions
  for select using (public.is_staff());
drop policy if exists "permissions: admin write" on public.permissions;
create policy "permissions: admin write" on public.permissions
  for all using (public.has_permission('user.write'))
  with check (public.has_permission('user.write'));

drop policy if exists "role_permissions: staff read" on public.role_permissions;
create policy "role_permissions: staff read" on public.role_permissions
  for select using (public.is_staff());
drop policy if exists "role_permissions: admin write" on public.role_permissions;
create policy "role_permissions: admin write" on public.role_permissions
  for all using (public.has_permission('user.write'))
  with check (public.has_permission('user.write'));

-- A user may see their own grants; only user.write may change any.
drop policy if exists "user_roles: read own or staff" on public.user_roles;
create policy "user_roles: read own or staff" on public.user_roles
  for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "user_roles: admin write" on public.user_roles;
create policy "user_roles: admin write" on public.user_roles
  for all using (public.has_permission('user.write'))
  with check (public.has_permission('user.write'));

-- ---------------------------------------------------------------------------
-- Seed the permission catalogue and the built-in roles
-- ---------------------------------------------------------------------------
insert into public.permissions (key, resource, action, description) values
  ('page.read',        'page',        'read',    'View pages in the admin'),
  ('page.write',       'page',        'write',   'Create and edit pages'),
  ('page.publish',     'page',        'publish', 'Publish and unpublish pages'),
  ('page.delete',      'page',        'delete',  'Delete pages'),
  ('template.read',    'template',    'read',    'View templates'),
  ('template.write',   'template',    'write',   'Create and edit templates'),
  ('template.publish', 'template',    'publish', 'Publish templates'),
  ('template.delete',  'template',    'delete',  'Delete templates'),
  ('pattern.read',     'pattern',     'read',    'View reusable patterns'),
  ('pattern.write',    'pattern',     'write',   'Create and edit patterns'),
  ('pattern.publish',  'pattern',     'publish', 'Publish patterns'),
  ('pattern.delete',   'pattern',     'delete',  'Delete patterns'),
  ('article.read',     'article',     'read',    'View articles'),
  ('article.write',    'article',     'write',   'Create and edit articles'),
  ('article.publish',  'article',     'publish', 'Publish articles'),
  ('article.delete',   'article',     'delete',  'Delete articles'),
  ('taxonomy.write',   'taxonomy',    'write',   'Manage categories, tags and authors'),
  ('media.read',       'media',       'read',    'Browse the media library'),
  ('media.write',      'media',       'write',   'Upload and edit media'),
  ('media.delete',     'media',       'delete',  'Delete media assets'),
  ('product.read',     'product',     'read',    'View products'),
  ('product.write',    'product',     'write',   'Create and edit products'),
  ('product.publish',  'product',     'publish', 'Publish products'),
  ('product.delete',   'product',     'delete',  'Delete products'),
  ('navigation.read',  'navigation',  'read',    'View menus'),
  ('navigation.write', 'navigation',  'write',   'Edit menus'),
  ('navigation.publish','navigation', 'publish', 'Publish menus'),
  ('theme.read',       'theme',       'read',    'View theme settings'),
  ('theme.write',      'theme',       'write',   'Edit design tokens and global styles'),
  ('theme.publish',    'theme',       'publish', 'Publish theme changes'),
  ('integration.read', 'integration', 'read',    'View feeds and connections'),
  ('integration.write','integration', 'write',   'Configure feeds and connections'),
  ('integration.run',  'integration', 'run',     'Trigger imports and syncs'),
  ('revision.read',    'revision',    'read',    'View revision history'),
  ('revision.restore', 'revision',    'restore', 'Roll back to a previous revision'),
  ('preview.create',   'preview',     'create',  'Create preview sessions'),
  ('user.read',        'user',        'read',    'View users and roles'),
  ('user.write',       'user',        'write',   'Manage users and role assignments'),
  ('settings.read',    'settings',    'read',    'View site settings'),
  ('settings.write',   'settings',    'write',   'Edit site settings')
on conflict (key) do nothing;

insert into public.roles (key, label, description, is_system) values
  ('admin',        'Administrator', 'Full access, including users and integrations.', true),
  ('editor',       'Editor',        'Builds and publishes all content and design.',   true),
  ('author',       'Author',        'Writes articles and uploads media; cannot publish.', true),
  ('merchandiser', 'Merchandiser',  'Manages products, feeds and merchandising.',     true),
  ('viewer',       'Viewer',        'Read-only access to the admin.',                 true)
on conflict (key) do nothing;

-- admin: everything in the catalogue.
insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

-- editor: all content, media, navigation and theme — but not users or integrations.
insert into public.role_permissions (role_key, permission_key)
select 'editor', key from public.permissions
where resource in ('page','template','pattern','article','taxonomy','media',
                   'navigation','theme','revision','preview','product')
   or key in ('settings.read','user.read')
on conflict do nothing;

-- author: writes articles and media, reads the rest. No publish rights.
insert into public.role_permissions (role_key, permission_key)
select 'author', key from public.permissions
where key in ('article.read','article.write','media.read','media.write',
              'page.read','template.read','pattern.read','taxonomy.write',
              'revision.read','preview.create','product.read','settings.read')
on conflict do nothing;

-- merchandiser: commerce and the feeds behind it.
insert into public.role_permissions (role_key, permission_key)
select 'merchandiser', key from public.permissions
where resource in ('product','integration')
   or key in ('media.read','media.write','page.read','pattern.read',
              'revision.read','preview.create','settings.read')
on conflict do nothing;

-- viewer: every read permission, nothing else.
insert into public.role_permissions (role_key, permission_key)
select 'viewer', key from public.permissions where action = 'read'
on conflict do nothing;
