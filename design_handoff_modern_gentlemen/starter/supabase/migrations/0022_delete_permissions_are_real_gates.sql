-- 0022 — every `*.delete` permission starts actually gating a delete.
--
-- `0018` fixed one instance of this shape and its closing comment named the
-- rest as deliberately out of scope. This is the rest.
--
-- ---------------------------------------------------------------------------
-- The defect
-- ---------------------------------------------------------------------------
-- Six tables pair a PERMISSIVE `for all` write policy with a PERMISSIVE
-- `for delete` policy:
--
--   create policy "articles: write"  on articles for all    using (has_permission('article.write'));
--   create policy "articles: delete" on articles for delete using (has_permission('article.delete'));
--
-- A policy with `cmd=ALL` applies to DELETE, and **permissive policies are
-- OR-ed**, so the effective rule is
--
--   article.write OR article.delete
--
-- `article.delete` is therefore strictly additive: it grants, and can never
-- refuse. Holding `article.write` alone is enough to delete any article. The
-- same reading applies to `page.delete`, `template.delete`, `pattern.delete`,
-- `product.delete` and `media.delete` — every delete permission in the
-- catalogue gates less than its name promises.
--
-- Verified against the live project rather than inferred from these files:
-- `pg_policies` returns exactly the pair above for all six tables.
--
-- ---------------------------------------------------------------------------
-- Why this is worth a migration when the service layer already checks
-- ---------------------------------------------------------------------------
-- Every delete route in the application calls `requirePermission()` with the
-- correct `x.delete` first — `deleteDocument` in `lib/services/documents.ts`,
-- `lib/services/media.ts` and `lib/services/products.ts`. So no button in the
-- admin gets past this today, and **this migration changes nothing an editor
-- can see.**
--
-- What it changes is what happens when the service layer is not in the path.
-- PostgREST is a public endpoint, the project URL and publishable key ship in
-- the client bundle by design, and a signed-in author holds a real JWT. A
-- direct `DELETE /rest/v1/articles?id=eq.…` carries none of the service
-- checks with it — RLS is the only thing between that request and the row,
-- and RLS currently allows it. The repository is public, so the policy
-- catalogue that says so is publicly readable.
--
-- ---------------------------------------------------------------------------
-- Who loses access, which is the decision inside this migration
-- ---------------------------------------------------------------------------
-- Read off `role_permissions` on the live project, not off `0001`:
--
--   resource   write                            delete                     loses
--   page       admin, editor                    admin, editor              nobody
--   template   admin, editor                    admin, editor              nobody
--   pattern    admin, editor                    admin, editor              nobody
--   product    admin, editor, merchandiser      admin, editor, merch.      nobody
--   article    admin, author, editor            admin, editor              author
--   media      admin, author, editor, merch.    admin, editor              author, merch.
--
-- Four of the six tighten nothing at all — the roles that can write can
-- already delete. The two real losses are both what the seeded role
-- descriptions already promise: `author` is "Writes articles and uploads
-- media; cannot publish", and `merchandiser` holds `media.write` for product
-- imagery rather than as a media librarian. Neither description implies
-- deleting anything.
--
-- `user_roles` on the live project holds one row — a single `admin`, who
-- loses nothing — so the production blast radius today is zero.
--
-- ---------------------------------------------------------------------------
-- Why `categories` is NOT in this list
-- ---------------------------------------------------------------------------
-- It has the same OR-ed shape and it was in scope until the delete routes were
-- actually read. A category has **two** of them, and they check different
-- permissions:
--
--   /admin/taxonomy  → taxonomy.deleteCategory  → requirePermission('taxonomy.write')
--   /admin/categories → documents.deleteDocument → requirePermission('category.delete')
--
-- and `0021` widened the write policy to `taxonomy.write OR category.write`
-- deliberately, so that "the `author` role behaves exactly as it did". A
-- restrictive `category.delete` gate would break the taxonomy screen's delete
-- for `author`, who holds `taxonomy.write` and not `category.delete` — a real
-- regression, and the opposite of what `0021` set out to preserve.
--
-- Reconciling those two service paths is the prerequisite, and it is a product
-- decision about what the taxonomy screen's delete means rather than a policy
-- repair. Left for a later migration; recorded in PROGRESS.md's Known issues so
-- the next session does not have to rediscover it by reading the same two
-- files.
--
-- ---------------------------------------------------------------------------
-- Why RESTRICTIVE, and why one per table rather than editing the write policy
-- ---------------------------------------------------------------------------
-- The argument is `0018`'s and has not changed: restrictive policies are AND-ed
-- with the whole permissive set, so one of them constrains *every* route to a
-- DELETE at once, including any policy added later. Folding the check into each
-- `x: write` policy would fix today's pairs and silently reopen the hole the
-- next time somebody adds a third policy — which is exactly how this arrived.
--
-- Each policy below says only "a delete requires the delete permission". It
-- adds no new grant: the permissive policies still decide who may delete, and
-- this removes from that set anyone who does not hold the matching `x.delete`.
--
-- ---------------------------------------------------------------------------
-- What this does NOT change
-- ---------------------------------------------------------------------------
--   * `service_role` has BYPASSRLS, so `scripts/seed.ts`, the scheduled-publish
--     job and the integration suite's fixture teardown are unaffected.
--   * Reading, writing and publishing. Only DELETE is touched.
--   * `pages`, beyond adding the permission gate alongside `0018`'s
--     `is_system` gate. Both are restrictive and both must now pass.
--   * The child tables (`product_variants`, `article_tags`, `product_media`,
--     …). They are reached by FK cascade, which does not consult RLS, and by
--     their own write policies, which are a separate question from this one.
--
-- Re-runnable, like every migration here: Postgres has no
-- `create policy if not exists`, so the drop is what makes a replay safe. The
-- `Migrations are idempotent` CI step re-applies all of them onto themselves
-- and fails if any statement complains.

drop policy if exists "pages: delete needs page.delete" on public.pages;
create policy "pages: delete needs page.delete" on public.pages
  as restrictive for delete using (public.has_permission('page.delete'));

drop policy if exists "templates: delete needs template.delete" on public.templates;
create policy "templates: delete needs template.delete" on public.templates
  as restrictive for delete using (public.has_permission('template.delete'));

drop policy if exists "patterns: delete needs pattern.delete" on public.patterns;
create policy "patterns: delete needs pattern.delete" on public.patterns
  as restrictive for delete using (public.has_permission('pattern.delete'));

drop policy if exists "articles: delete needs article.delete" on public.articles;
create policy "articles: delete needs article.delete" on public.articles
  as restrictive for delete using (public.has_permission('article.delete'));

drop policy if exists "products: delete needs product.delete" on public.products;
create policy "products: delete needs product.delete" on public.products
  as restrictive for delete using (public.has_permission('product.delete'));

drop policy if exists "media_assets: delete needs media.delete" on public.media_assets;
create policy "media_assets: delete needs media.delete" on public.media_assets
  as restrictive for delete using (public.has_permission('media.delete'));
