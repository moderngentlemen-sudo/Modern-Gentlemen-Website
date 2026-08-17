-- 0021 — Categories become the sixth document type.
--
-- `0004_editorial.sql` gave `categories` the full versioning column set —
-- draft_data / published_data / version / status / published_at — and since
-- Phase 7c `/[category]` has rendered `categories.published_data` through the
-- same `SectionRenderer` the rest of the public site uses. **The page is live
-- and there has never been a way to edit it.** `lib/services/taxonomy.ts`
-- deliberately does not touch `draft_data`, and `document_table()` is an
-- allowlist that 'category' was not on, so every publish, unpublish, snapshot
-- and rollback against one raised "not a publishable entity type".
--
-- `0014` left it that way on purpose and said why: categories "carry the same
-- columns but are not independently publishable, and adding it would imply a UI
-- that does not exist". That UI is what this migration is for. The condition
-- 0014 set is now met, which is the whole justification for moving the line.
--
-- ---------------------------------------------------------------------------
-- What was already true, and needed nothing
-- ---------------------------------------------------------------------------
--   * `revisions` and `publish_events` key on `entity_type` text with **no
--     foreign key** — polymorphic since `0008`, deliberately — so a sixth type
--     gets history and rollback for free.
--   * `publish_document` is entirely generic apart from two lookups: the table
--     allowlist below, and a permission named `<type>.publish`.
--   * `schedulable_document_table()` is **deliberately not touched.**
--     `categories` has no `scheduled_for` column, and its status CHECK is
--     ('draft','published','archived') with no 'scheduled' — so unlike
--     `products` there is no unreachable status here to worry about.
--     `SCHEDULABLE_TYPES` in `lib/domain/documents.ts` keeps it out of the UI.
--
-- ---------------------------------------------------------------------------
-- Permissions: why four new ones rather than reusing `taxonomy.write`
-- ---------------------------------------------------------------------------
-- `publish_document` asserts `has_permission(p_entity_type || '.publish')`. The
-- string is built from the type, so publishing a category requires a permission
-- literally named `category.publish`. There is no way to satisfy that with
-- `taxonomy.write`, and the alternative — special-casing the name inside a
-- SECURITY INVOKER function every type depends on — would be worse than four
-- rows.
--
-- So the four are seeded and the role grants from `0001` are **re-run**. Those
-- statements are `select … from public.permissions … on conflict do nothing`,
-- so replaying them is how a new permission reaches the roles that should have
-- it; without this, `admin` would not hold the permissions this migration
-- creates, because 0001's grant already ran against a smaller catalogue.
--
-- ⚠️ **`taxonomy.write` keeps working.** The `categories: write` policy is
-- widened to accept either permission rather than replaced, so nothing that can
-- edit a category today loses that ability — `author` in particular holds
-- `taxonomy.write` and is granted `category.write` below to match.
--
-- Re-runnable, like every migration here: `create or replace` for the function,
-- `on conflict do nothing` for the seeds, and `drop policy if exists` before the
-- create. The `Migrations are idempotent` CI step replays all of them onto
-- themselves and fails if any statement complains.

-- ------------------------------------------------------- the allowlist itself

create or replace function public.document_table(p_entity_type text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_entity_type
    when 'page'     then 'pages'
    when 'template' then 'templates'
    when 'pattern'  then 'patterns'
    when 'article'  then 'articles'
    when 'product'  then 'products'
    when 'category' then 'categories'
  end;
$$;

-- `create or replace` preserves the existing ACL, so `0010`'s revoke/grant pair
-- still holds. Restated because it is cheap, idempotent, and because a function
-- that silently kept EXECUTE for `anon` would be a bad thing to discover later.
revoke execute on function public.document_table(text) from public, anon;
grant execute on function public.document_table(text) to authenticated;

-- ------------------------------------------------------------- permissions

insert into public.permissions (key, resource, action, description) values
  ('category.read',    'category', 'read',    'View category page layouts'),
  ('category.write',   'category', 'write',   'Edit category page layouts'),
  ('category.publish', 'category', 'publish', 'Publish category pages'),
  ('category.delete',  'category', 'delete',  'Delete category pages')
on conflict (key) do nothing;

-- Re-run `0001`'s grants so the new permissions reach the right roles. Each is
-- the original statement verbatim; `on conflict do nothing` makes the replay a
-- no-op for everything that already exists.

-- admin: everything in the catalogue.
insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

-- editor: all content, media, navigation and theme — plus category now.
insert into public.role_permissions (role_key, permission_key)
select 'editor', key from public.permissions
where resource in ('page','template','pattern','article','taxonomy','media',
                   'navigation','theme','revision','preview','product','category')
   or key in ('settings.read','user.read')
on conflict do nothing;

-- author: already manages categories through `taxonomy.write`, so it keeps that
-- ability under the new vocabulary. Still no publish rights, as before.
insert into public.role_permissions (role_key, permission_key)
select 'author', key from public.permissions
where key in ('category.read','category.write')
on conflict do nothing;

-- viewer: every read permission, nothing else.
insert into public.role_permissions (role_key, permission_key)
select 'viewer', key from public.permissions where action = 'read'
on conflict do nothing;

-- --------------------------------------------------------------------- RLS

-- Widened, not replaced: `taxonomy.write` still grants category writes, so the
-- taxonomy screen and the `author` role behave exactly as they did.
drop policy if exists "categories: write" on public.categories;
create policy "categories: write" on public.categories for all
  using (public.has_permission('taxonomy.write') or public.has_permission('category.write'))
  with check (public.has_permission('taxonomy.write') or public.has_permission('category.write'));
