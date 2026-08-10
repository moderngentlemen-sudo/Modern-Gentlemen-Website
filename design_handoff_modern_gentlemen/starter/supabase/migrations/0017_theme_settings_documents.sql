-- 0017 — The theme becomes the sixth document type, and stops handing its
-- unpublished draft to anonymous readers.
--
-- Two changes that look unrelated and are not: the moment a theme is editable is
-- the moment publishing has to work AND the moment its draft is worth hiding.
-- Splitting them across two migrations would ship an editor whose drafts leak
-- for however long the second one took to arrive.
--
-- ---------------------------------------------------------------------------
-- 1. document_table()
-- ---------------------------------------------------------------------------
-- `0007` gave `theme_settings` the full versioning column set — draft_data /
-- published_data / version / status / published_at / updated_by — and then
-- nothing ever used it, exactly as `0005` did for products before `0014`. Same
-- one-line fix, same reasoning, and every precondition is already met:
--
--   * `publish_document` (0010:68-133) touches only version, draft_data,
--     published_data, status, published_at and updated_by. `theme_settings` has
--     all six. There is no slug coupling anywhere in the function.
--   * `revisions` and `publish_events` key on `entity_type text` with no foreign
--     key and — verified across all sixteen migrations — no CHECK constraint, so
--     a sixth type needs no schema change to get history, audit and rollback.
--   * `theme_settings.status` permits draft/published/archived, which is
--     precisely what publish_document and unpublish_document write.
--   * `0001` already seeds theme.read / theme.write / theme.publish and grants
--     the whole `theme` resource to admin and editor, so
--     `has_permission(p_entity_type || '.publish')` resolves.
--
-- `schedulable_document_table()` is deliberately NOT touched: `theme_settings`
-- has no `scheduled_for` column and no 'scheduled' status, and publish_document
-- builds its clear-schedule clause only for types that have one.
--
-- NOTE the reach this widens, because it is not obvious from the diff:
-- `resolve_preview` (0010:405) also resolves its table through document_table,
-- so a preview session naming entity_type='theme' would now return theme
-- draft_data. Nothing in the application can mint one — createPreview in
-- lib/services/preview.ts takes a DocumentType, and 'theme' is deliberately not
-- one (see lib/domain/theme.ts for why widening DOCUMENT_TYPES does not
-- typecheck) — but a row inserted by hand would work. preview.create is
-- staff-only, so this is a widening rather than a hole.

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
    when 'theme'    then 'theme_settings'
  end;
$$;

-- `create or replace` preserves the existing ACL, so 0010's revoke/grant pair
-- still holds. Restated for the reason 0014 gave: it is cheap, it is idempotent,
-- and a function that silently kept EXECUTE for `anon` would be a bad thing to
-- discover later.
revoke execute on function public.document_table(text) from public, anon;
grant execute on function public.document_table(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Read scope
-- ---------------------------------------------------------------------------
-- `0007` left this policy at `using (true)`. Every other publishable table in
-- the schema is gated on `status = 'published' or is_staff()`; theme_settings
-- was the exception, and the exception was harmless only while the table held a
-- single row with an empty draft.
--
-- This is byte-for-byte the gap `0015` closed for `menu_items`, and it arms the
-- same way: a theme editor is what puts an unpublished payload in the row. A
-- colour scheme being trialled — a rebrand, a seasonal palette, a partner
-- takeover — would otherwise be readable by anon with one request against a
-- table whose name is in the public API.
--
-- Deliberately NOT addressed here, because it is not this table's problem: a
-- *published* row is readable in full, `draft_data` column included. That is
-- equally true of pages, articles and products — `0012` grants DML on every
-- table to anon and RLS is row-level, not column-level. Fixing it means column
-- privileges or a view, across six tables, and does not belong in a theme
-- migration. This policy matches the existing stance rather than diverging from
-- it.
--
-- Re-runnable, like every migration in this repo: Postgres has no
-- `create policy if not exists`, so the drop is what makes a replay safe. The
-- `Migrations are idempotent` CI step re-applies all of them onto themselves and
-- fails if any statement complains.

drop policy if exists "theme_settings: public read" on public.theme_settings;
create policy "theme_settings: public read" on public.theme_settings
  for select using (status = 'published' or public.is_staff());
