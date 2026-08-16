-- 0020 — `anon` stops being able to read `draft_data`.
--
-- Seven tables carry a `draft_data` column: pages, articles, categories,
-- products, theme_settings, templates and patterns. `0012` grants SELECT on
-- every public table to `anon`, and **RLS is row-level, not column-level** — so
-- a row that RLS correctly hands over (a *published* page) hands over all of its
-- columns, the unpublished draft included.
--
-- Confirmed against the live deployment before this migration existed:
-- `GET /rest/v1/pages?select=slug,status,draft_data` with the publishable key
-- returned the home page's full `draft_data`. `rls.test.ts` has asserted it as a
-- `KNOWN GAP` characterisation test since PR #37, carrying the instruction to
-- invert it the day it was closed. This is that day; the assertion is inverted
-- in the same commit, as `0018`'s was.
--
-- The practical shape of the leak: the moment an editor starts revising a live
-- page, its unpublished text is served to anyone who asks for that column —
-- before it has been approved, and with no error anywhere to suggest it.
--
-- ---------------------------------------------------------------------------
-- Why a column-level REVOKE alone does not work
-- ---------------------------------------------------------------------------
-- Postgres will accept `revoke select (draft_data) on pages from anon`, and it
-- will do nothing useful here: that statement removes *column-level* grants,
-- while `0012` granted at the **table** level, and a table-level SELECT implies
-- every column including ones added later. The privilege has to be removed at
-- the table level and re-granted per column, which is what this migration does.
--
-- The cost is that these lists must track the schema. That is deliberate and
-- **fail-closed**: a column added later is invisible to `anon` until it is
-- granted here, so the failure mode of forgetting is a missing field on the
-- public site — loud, and caught by the public read suites — rather than a
-- silent re-exposure of the draft.
--
-- ---------------------------------------------------------------------------
-- What this does NOT close, and cannot
-- ---------------------------------------------------------------------------
-- ⚠️ **`authenticated` keeps `draft_data`, so a signed-in account with no roles
-- can still read the draft of a published row.** That is not an oversight: the
-- admin reads drafts through the editor's own session, which *is* the
-- `authenticated` role, so revoking there would break the builder outright.
-- Column privileges cannot tell staff from non-staff — distinguishing them is
-- exactly what `is_staff()` does at the row level, and there is no column-level
-- equivalent. Closing that remainder means moving staff draft reads behind a
-- `security definer` function or a separate table, which is a larger change than
-- this one and belongs in its own slice. The internet-facing half is what this
-- migration closes; see PROGRESS.md.
--
-- ⚠️ **Consequence for synced patterns, recorded because it is load-bearing
-- later.** `expandPatternRefs` reads `patterns` directly with the caller's
-- session, and `/preview/[token]` is explicitly reachable by a signed-*out*
-- viewer — whose role is `anon`. After this migration such a viewer cannot read
-- `patterns.draft_data`, so a synced pattern's *draft* would not expand in an
-- anonymous preview. Nothing breaks today: no pattern is synced (the create
-- action hard-codes `detachable`) and the table is empty. Whoever builds synced
-- patterns must route that read the way `0010` already routes a page's draft to
-- an anonymous previewer — through `resolve_preview`, a `security definer`
-- function that checks the token inside the database — rather than through a
-- table grant.
--
-- ---------------------------------------------------------------------------
-- Unaffected
-- ---------------------------------------------------------------------------
--   * `service_role` (BYPASSRLS, and granted separately) — seeds, the scheduled
--     publish job and the integration suite's fixtures are untouched.
--   * `authenticated` — every admin screen reads exactly as before.
--   * Row visibility. This migration changes *columns*, not policies; drafts are
--     still hidden as rows by the `status = 'published' or is_staff()` policies.
--   * `published_data`, which is what every public route actually renders.
--
-- Re-runnable: `revoke` and `grant` are both idempotent, and the revoke runs
-- first each time. The `Migrations are idempotent` CI step replays every
-- migration onto itself — note that includes `0012` re-granting table-level
-- SELECT before this file revokes it again, which is why the order matters and
-- why this must stay a later migration than `0012`.

-- ------------------------------------------------------------------- pages

revoke select on public.pages from anon;
grant select (
  id, slug, title, template_id, is_system, status,
  published_data, version, published_at, scheduled_for,
  created_by, updated_by, created_at, updated_at
) on public.pages to anon;

-- ---------------------------------------------------------------- articles

revoke select on public.articles from anon;
grant select (
  id, slug, title, subtitle, excerpt, template, template_id, category_id,
  author_id, featured_asset_id, reading_minutes, issue_no, status,
  published_data, version, published_at, scheduled_for,
  created_by, updated_by, created_at, updated_at
) on public.articles to anon;

-- -------------------------------------------------------------- categories

revoke select on public.categories from anon;
grant select (
  id, slug, name, intro, position, hero_asset_id, template_id, status,
  published_data, version, published_at, created_at, updated_at
) on public.categories to anon;

-- ---------------------------------------------------------------- products

revoke select on public.products from anon;
grant select (
  id, slug, source_id, external_id, fulfilment, name, cat, cat_label, sku,
  blurb, story, material, price_pence, compare_at_pence, currency, stock,
  track_inventory, availability, badges, specs, affiliate, position, status,
  published_data, version, published_at, content_hash,
  created_by, updated_by, created_at, updated_at
) on public.products to anon;

-- ---------------------------------------------------------- theme_settings

revoke select on public.theme_settings from anon;
grant select (
  id, key, name, status,
  published_data, version, published_at, updated_by, created_at, updated_at
) on public.theme_settings to anon;

-- --------------------------------------------------------------- templates

revoke select on public.templates from anon;
grant select (
  id, key, kind, name, description, is_global, locked, status,
  published_data, version, published_at,
  created_by, updated_by, created_at, updated_at
) on public.templates to anon;

-- ---------------------------------------------------------------- patterns

revoke select on public.patterns from anon;
grant select (
  id, key, name, description, category_id, sync_mode, preview_asset_id, status,
  published_data, version, published_at,
  created_by, updated_by, created_at, updated_at
) on public.patterns to anon;
