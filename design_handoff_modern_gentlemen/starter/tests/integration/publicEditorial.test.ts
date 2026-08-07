/**
 * The published editorial pages, read the way an anonymous visitor reads them.
 *
 * This is the assertion the whole of Phase 7c rests on, and it is the same
 * technique 7a and 7b used before switching a route: prove the database
 * reproduces the composition the site was verified against, then switch the
 * source.
 *
 * It is a real assertion rather than a tautology only because `lib/demo/*` is
 * seed **input**. `scripts/seed.ts` reads those modules to write rows; this file
 * reads the rows back through the anonymous client, the real RLS policies, the
 * real binding engine, and compares. A mapping that dropped a field, a binding
 * that returned the wrong six stories, a card tag that lost its subcategory —
 * all of them fail here, and none of them would fail a screenshot that was
 * simply never rebuilt.
 *
 * Requires a seeded stack — CI's `Seed content` step provides one.
 */

import { describe, expect, it } from "vitest";

import { resolveBindings } from "@/lib/blocks/binding";
import { normalizeBlock } from "@/lib/blocks/normalize";
import type { BlockNode } from "@/lib/blocks/types";
import { supabaseBindingSources } from "@/lib/services/bindingSources";
import {
  getPublishedArticle,
  getPublishedCategory,
  listPublishedArticleSlugs,
  listPublishedCategorySlugs,
} from "@/lib/services/publicEditorial";
import { ARTICLES, articleSlugs, getArticleBySlug } from "@/lib/demo/articles";
import { categoryDocumentSections, demoCategorySections } from "@/lib/demo/category-sections";
import { categorySlugs } from "@/lib/demo/editorial";
import { adminClient } from "../support/fixtures";
import { testEnv } from "../setup/integration.setup";

/** What the renderer actually spreads onto a component: defaults applied,
 *  undeclared keys dropped, resolved bindings folded in over the descriptor. */
const renderedProps = (tree: BlockNode[]) =>
  tree.map((node) => ({ _type: node._type, props: normalizeBlock(node) }));

describe("the published articles", () => {
  it("publishes every article the demo content describes", async () => {
    const slugs = await listPublishedArticleSlugs();

    expect(slugs.sort()).toEqual([...articleSlugs].sort());
  });

  it("resolves each one to the shape the demo module produced", async () => {
    for (const slug of articleSlugs) {
      // Deep equality on the whole object, not a field at a time: the point is
      // that nothing was dropped or invented in the mapping, and picking fields
      // would exempt whichever one a future change forgets.
      expect(await getPublishedArticle(slug), slug).toEqual(getArticleBySlug(slug));
    }
  });

  it("gives the cover story its curated KEEP READING trio", async () => {
    // The one article with a visual baseline. Its related list comes from
    // `article_relations` because the demo's ordering — module insertion order —
    // is not something any column reproduces.
    const article = await getPublishedArticle("speed-considered");

    expect(article?.related).toHaveLength(3);
    expect(article?.related).toEqual(getArticleBySlug("speed-considered")?.related);
  });

  it("returns null for a slug nobody published", async () => {
    expect(await getPublishedArticle("not-an-article")).toBeNull();
  });

  it("lists thirty-five stories across the five categories, and no showcase", async () => {
    // Load-bearing, not incidental: several template showcases carry labels that
    // match a real category — two are "Culture" at issue 042, the same issue as
    // the Culture lead — so filing them would tie in the `issue desc` ordering
    // and displace the lead. They are filed under nothing, and the homepage
    // cover story with them, exactly as the demo pages list them.
    const listed = new Set<string>();

    for (const slug of categorySlugs) {
      const doc = await getPublishedCategory(slug);
      const resolved = (await resolveBindings(
        doc!.sections,
        supabaseBindingSources
      )) as BlockNode[];
      const lead = normalizeBlock(resolved[1]) as { article: { href: string } };
      const grid = normalizeBlock(resolved[2]) as { items: { href: string }[] };

      for (const href of [lead.article.href, ...grid.items.map((i) => i.href)]) {
        listed.add(href.replace("/article/", ""));
      }
    }

    expect(listed.size).toBe(35);
    expect(listed.has("speed-considered")).toBe(false);
    // And every listed story is a real article rather than a dangling link.
    for (const slug of listed) expect(ARTICLES[slug], slug).toBeDefined();
  });
});

describe("the published category pages", () => {
  it("publishes all five", async () => {
    expect((await listPublishedCategorySlugs()).sort()).toEqual([...categorySlugs].sort());
  });

  it("renders exactly what the route composed in code before Phase 7c", async () => {
    for (const slug of categorySlugs) {
      const doc = await getPublishedCategory(slug);
      expect(doc, slug).not.toBeNull();

      const resolved = await resolveBindings(doc!.sections, supabaseBindingSources);

      // The comparison that matters: not the stored payloads, which differ by
      // design — one holds `$bind` descriptors where the other holds copied
      // cards — but the props the section components receive.
      expect(renderedProps(resolved as BlockNode[]), slug).toEqual(
        renderedProps(demoCategorySections(slug) as unknown as BlockNode[])
      );
    }
  });

  it("stores the bound descriptors rather than the resolved cards", async () => {
    // The other half of the point. If seeding had written literals, the test
    // above would pass and the page would silently stop updating when an
    // article is published.
    const doc = await getPublishedCategory("style");
    const [, lead, grid] = doc!.sections as BlockNode[];

    expect((lead as unknown as { article: unknown }).article).toHaveProperty("$bind");
    expect((grid as unknown as { items: unknown }).items).toHaveProperty("$bind");
    expect(doc!.sections).toEqual(categoryDocumentSections("style"));
  });

  it("does not repeat the lead as the grid's first card", async () => {
    // What `offset` was added for. Without it both blocks read the same
    // ordering from row one and the newest story appears twice.
    for (const slug of categorySlugs) {
      const doc = await getPublishedCategory(slug);
      const resolved = (await resolveBindings(
        doc!.sections,
        supabaseBindingSources
      )) as BlockNode[];

      const lead = normalizeBlock(resolved[1]) as { article: { href: string } };
      const grid = normalizeBlock(resolved[2]) as { items: { href: string }[] };

      expect(grid.items, slug).toHaveLength(6);
      expect(
        grid.items.map((i) => i.href),
        slug
      ).not.toContain(lead.article.href);
    }
  });

  it("returns null for a slug nobody published", async () => {
    expect(await getPublishedCategory("motoring")).toBeNull();
  });

  // Every other test here only reads. This one unpublishes a real article, so it
  // runs against a throwaway local stack only — on the shared remote project a
  // failure between the update and the restore would leave a story off the site.
  it.runIf(testEnv.isLocal)("drops an unpublished article from its category page", async () => {
    const db = adminClient();
    const doc = await getPublishedCategory("style");
    const before = (await resolveBindings(doc!.sections, supabaseBindingSources)) as BlockNode[];
    const victim = (normalizeBlock(before[2]) as { items: { href: string }[] }).items[0];
    const slug = victim.href.replace("/article/", "");

    const { error } = await db.from("articles").update({ status: "draft" }).eq("slug", slug);
    expect(error).toBeNull();

    try {
      const after = (await resolveBindings(doc!.sections, supabaseBindingSources)) as BlockNode[];
      const items = (normalizeBlock(after[2]) as { items: { href: string }[] }).items;

      expect(items.map((i) => i.href)).not.toContain(victim.href);
      // Five, not six: each category has exactly seven filed stories, so
      // unpublishing one leaves the lead and five cards. The page re-queries
      // rather than rendering a hole where a copied card used to be — which is
      // the difference between a bound listing and a stored one.
      expect(items).toHaveLength(5);
    } finally {
      // Restore whatever the outcome, so a failure here cannot leave the
      // database in a state that fails every later run.
      await db.from("articles").update({ status: "published" }).eq("slug", slug);
    }
  });
});
