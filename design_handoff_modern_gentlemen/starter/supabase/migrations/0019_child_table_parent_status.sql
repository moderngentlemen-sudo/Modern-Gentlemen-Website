-- 0019 — a child row stops being readable when its parent is not.
--
-- Five tables shipped their public read policy as `using (true)`:
--
--   article_tags             (0004)
--   article_relations        (0004)
--   product_variants         (0005)
--   product_media            (0005)
--   product_collection_items (0005)
--
-- while every one of their parents is scoped to `status = 'published' or
-- is_staff()`. RLS is row-level and these are separate tables, so the parent's
-- scope does not reach them: a **draft** product is correctly hidden at
-- `products` and its variants — sku, price_pence, options, stock — are served to
-- anyone who asks `product_variants` directly. Same for its gallery, and for a
-- draft article's tags.
--
-- `0012` is what makes this reachable rather than theoretical: it grants full
-- DML on every public table to `anon`, so nothing is protected by a missing
-- GRANT. If a policy is `using (true)`, the table is open.
--
-- Nothing leaks from the seeded data today — `product_variants` and
-- `product_collection_items` are empty, and every seeded product is published —
-- which is exactly why this is worth closing now rather than after something
-- lands in them. ⚠️ **Ingestion points straight at it**: `applyJob` creates
-- imported products as DRAFTS by design, so the first feed run against a real
-- catalogue would stage unreleased pricing one join away from the public.
--
-- ---------------------------------------------------------------------------
-- The shape is `0015`'s, deliberately
-- ---------------------------------------------------------------------------
-- `menu_items` had the identical defect and `0015` fixed it with an `exists`
-- join onto the parent, repeating the parent's own condition rather than relying
-- on the parent's policy to filter the subquery. Repeating it is the point: the
-- policy is then self-contained and survives someone widening the parent's read
-- scope later. These five are the same fix applied to the tables `0015` did not
-- cover, and the phrasing is copied so the catalogue reads consistently.
--
-- PERMISSIVE (the default), not RESTRICTIVE as in `0018`. `0018` was narrowing a
-- rule that several policies could route around, so it needed the AND. Here each
-- table has exactly one SELECT policy and it is being replaced outright, so a
-- permissive policy expresses it directly.
--
-- ---------------------------------------------------------------------------
-- The two-parent tables require BOTH ends, and that is a decision
-- ---------------------------------------------------------------------------
-- `article_relations` references two articles (`article_id`, `related_id`) and
-- `product_collection_items` references a collection and a product. Checking
-- only the owning side would still disclose the *existence* and the id of an
-- unpublished row on the other end. Requiring both means a published article
-- relating to a draft one shows nothing publicly until the draft is published,
-- which is the behaviour an editor would expect from a "related content" list.
--
-- Neither table has a public consumer today (`article_relations` has rows and no
-- UI; the PDP shows one price and no variant picker), so this tightening changes
-- no rendered page. It constrains what the tables will permit when those
-- consumers are eventually built.
--
-- ---------------------------------------------------------------------------
-- What this does NOT change
-- ---------------------------------------------------------------------------
--   * The write policies. All five keep `article.write` / `product.write`
--     exactly as `0004` and `0005` set them; this migration is about SELECT.
--   * Staff. `is_staff()` is the same escape hatch the parents carry, so every
--     admin screen sees drafts and their children as before.
--   * `service_role`, which has BYPASSRLS — seeds, `scripts/seed.ts`, ingestion's
--     apply path and the integration suite's teardown are untouched.
--   * The public store and editorial reads. They only ever join children to
--     PUBLISHED parents, so every row they fetch today still satisfies the new
--     condition. The 16 visual baselines should not move.
--
-- Re-runnable, like every migration here: Postgres has no
-- `create policy if not exists`, so the drop is what makes a replay safe. The
-- `Migrations are idempotent` CI step re-applies all of them onto themselves and
-- fails if any statement complains.

-- --------------------------------------------------------------------- editorial

drop policy if exists "article_tags: public read" on public.article_tags;
create policy "article_tags: public read" on public.article_tags for select using (
  exists (
    select 1
    from public.articles a
    where a.id = article_tags.article_id
      and (a.status = 'published' or public.is_staff())
  )
);

drop policy if exists "article_relations: public read" on public.article_relations;
create policy "article_relations: public read" on public.article_relations for select using (
  exists (
    select 1
    from public.articles a
    where a.id = article_relations.article_id
      and (a.status = 'published' or public.is_staff())
  )
  and exists (
    select 1
    from public.articles r
    where r.id = article_relations.related_id
      and (r.status = 'published' or public.is_staff())
  )
);

-- --------------------------------------------------------------------- commerce

drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants for select using (
  exists (
    select 1
    from public.products p
    where p.id = product_variants.product_id
      and (p.status = 'published' or public.is_staff())
  )
);

drop policy if exists "product_media: public read" on public.product_media;
create policy "product_media: public read" on public.product_media for select using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and (p.status = 'published' or public.is_staff())
  )
);

drop policy if exists "product_collection_items: public read" on public.product_collection_items;
create policy "product_collection_items: public read" on public.product_collection_items
  for select using (
    exists (
      select 1
      from public.product_collections c
      where c.id = product_collection_items.collection_id
        and (c.status = 'published' or public.is_staff())
    )
    and exists (
      select 1
      from public.products p
      where p.id = product_collection_items.product_id
        and (p.status = 'published' or public.is_staff())
    )
  );
