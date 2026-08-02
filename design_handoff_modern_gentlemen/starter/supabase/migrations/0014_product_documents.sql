-- 0014 — Products become the fifth document type.
--
-- `0005_commerce.sql` gave `products` the full versioning column set —
-- draft_data / published_data / version / status / published_at — the same one
-- `0003` gave pages and `0004` gave articles. Nothing has ever used it, because
-- `document_table()` is an allowlist and 'product' was not on it: every
-- publish, unpublish, snapshot and rollback against a product raised
-- "not a publishable entity type".
--
-- This migration adds the one line that changes. Everything else the publishing
-- machinery needs is already true:
--
--   * `revisions` and `publish_events` key on `entity_type` text with NO
--     foreign key — polymorphic since 0008, deliberately, so a fifth type needs
--     no schema change to get history and rollback.
--   * `publish_document` asserts `p_entity_type || '.publish'`, and 0001 already
--     seeds product.read / product.write / product.publish / product.delete.
--   * RLS on `products` is already gated on product.write / product.delete.
--
-- `schedulable_document_table()` is deliberately NOT touched. `products` has no
-- `scheduled_for` column, and `publish_document` builds its clear-schedule
-- clause only for types that do. Note the loose end this leaves, which is
-- 0005's and is not fixed here: `products.status` permits 'scheduled' with no
-- column to hold the date. `SCHEDULABLE_TYPES` in lib/domain/documents.ts keeps
-- that status out of the product UI, so nothing can reach the constraint.
--
-- `categories` still stays off the list, for the reason 0010 gave: it carries
-- the same columns but is not independently publishable, and adding it would
-- imply a UI that does not exist.

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
  end;
$$;

-- `create or replace` preserves the existing ACL, so 0010's revoke/grant pair
-- still holds. Restated because it is cheap, idempotent, and because a function
-- that silently kept EXECUTE for `anon` would be a bad thing to discover later.
revoke execute on function public.document_table(text) from public, anon;
grant execute on function public.document_table(text) to authenticated;
