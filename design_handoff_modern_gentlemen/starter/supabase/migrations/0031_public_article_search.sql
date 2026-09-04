-- 0031 — let anonymous public search use the generated article vector.
--
-- Migration 0020 intentionally replaced anon's table-level SELECT privilege
-- with a fail-closed list of public columns so `draft_data` can never leak.
-- Consequently, the `search_vector` column introduced later by 0030 is not
-- addressable through PostgREST until it is explicitly granted. The vector is
-- derived only from title, subtitle, excerpt and slug, which anon may already
-- read, and row-level security still restricts anon to published articles.
--
-- A column grant is additive and idempotent. Keep this as a follow-up migration
-- rather than editing 0030 so databases that have already recorded 0030 also
-- receive the privilege.

grant select (search_vector) on public.articles to anon;
