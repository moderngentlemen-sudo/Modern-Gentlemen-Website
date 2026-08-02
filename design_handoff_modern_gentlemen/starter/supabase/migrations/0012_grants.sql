-- Table grants, stated explicitly instead of inherited from the environment.
--
-- Migrations 0001–0011 never granted a single table privilege. On the hosted
-- project that went unnoticed because Supabase's bootstrap configures
-- `alter default privileges ... grant all on tables to anon, authenticated,
-- service_role`, so every table created by a migration picked them up silently.
-- A stack created by `supabase start` does not reproduce that, so in CI no role
-- held any privilege and every integration fixture failed with
-- "permission denied for table pages" — the first time those tests had ever run
-- far enough to say so.
--
-- Verified against the live project before writing this: anon, authenticated,
-- postgres and service_role each already hold the full DML set on `pages`. These
-- statements reproduce the hosted state rather than change it, and `grant` is
-- idempotent, so applying this upstream is a no-op.
--
-- On the breadth: granting DML to `anon` looks alarming and is not. It is the
-- Supabase model the rest of this schema is built on — the grant opens the table
-- to PostgREST, and RLS is what decides who may see or change a row.
-- PROGRESS.md describes the same three layers: RLS deepest and unbypassable,
-- `requirePermission()` above it, permission-filtered UI on top. Every table
-- here has RLS enabled by its own migration, and a grant without a policy still
-- returns nothing.
--
-- Deliberately absent: any statement about functions. Postgres already grants
-- EXECUTE to PUBLIC on creation, which is precisely why 0009, 0010 and 0011
-- spend their closing lines *revoking* it from `anon` on the publishing
-- functions. A blanket `grant execute on all functions` here would silently undo
-- those revokes and hand an anonymous caller `publish_document`. Function
-- privileges stay where their own migrations set them.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Tables added by later migrations inherit the same treatment, so this file does
-- not need revisiting whenever the schema grows.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
