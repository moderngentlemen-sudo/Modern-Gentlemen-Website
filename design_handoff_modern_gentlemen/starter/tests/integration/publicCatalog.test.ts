/**
 * The published store, read the way an anonymous visitor reads it.
 *
 * This is the assertion the whole of Phase 7b rests on. The visual suite proves
 * the store still *looks* right; it cannot prove the pixels came from the
 * database rather than from a stale build, and it would pass just as happily if
 * the query returned the demo module by accident. This test closes that gap by
 * checking the two against each other, field by field, through the real
 * anonymous client and the real RLS policies.
 *
 * It is the same technique Phase 7a used before switching the homepage: prove
 * the stored payload equals the module the site was verified against, then
 * switch the source.
 *
 * Requires a seeded stack — CI's `Seed content` step provides one.
 */

import { describe, expect, it } from "vitest";

import { getPublishedProductSeo, listPublishedProducts } from "@/lib/services/publicCatalog";
import { allProducts } from "@/lib/demo/catalog";
import { poundsToPence } from "@/lib/domain/money";
import { productJsonLd } from "@/lib/domain/seo";
import { adminClient } from "../support/fixtures";
import { testEnv } from "../setup/integration.setup";

const demo = allProducts();

describe("the published catalogue", () => {
  it("returns every seeded product through the anonymous client", async () => {
    const products = await listPublishedProducts();

    expect(products).toHaveLength(demo.length);
    expect(products.map((p) => p.slug).sort()).toEqual(demo.map((p) => p.slug).sort());
  });

  it("matches the demo catalogue on every rendered field", async () => {
    const products = await listPublishedProducts();
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    for (const expected of demo) {
      // Deep equality on the whole object, not a field at a time: the point is
      // that nothing was dropped in the mapping, and picking fields to compare
      // would exempt whichever one a future change forgets.
      expect(bySlug.get(expected.slug)).toEqual(expected);
    }
  });

  it("gives every product its imagery", async () => {
    const products = await listPublishedProducts();

    // The blocker this phase opened with: 16 published products and 0
    // product_media rows. A regression in the seed or the join would put it
    // back, and the only visible symptom would be empty frames.
    for (const product of products) {
      expect(product.images.length).toBeGreaterThan(0);
      for (const url of product.images) {
        expect(url).toMatch(/^(https?:\/\/|\/)/);
      }
    }
  });

  it("orders the gallery by position, so the hero image is the first one", async () => {
    const products = await listPublishedProducts();

    for (const product of products) {
      const expected = demo.find((p) => p.slug === product.slug);
      expect(product.images).toEqual(expected?.images);
    }
  });

  /**
   * `getPublishedProductSeo` is a second, narrower read of the same rows, and a
   * second read is a second chance to disagree with the first. The risk is not
   * that it fails loudly — it is that a PDP's `<head>` quietly advertises a
   * different price, or a different photograph, from the one on the page below
   * it. Structured data that contradicts the visible page is worse than none:
   * Google treats it as a manipulation signal.
   */
  it("agrees with the catalogue read on the fields both return", async () => {
    for (const expected of demo) {
      const seo = await getPublishedProductSeo(expected.slug);

      expect(seo, expected.slug).not.toBeNull();
      expect(seo!.name).toBe(expected.name);
      expect(seo!.blurb).toBe(expected.blurb);
      expect(seo!.material).toBe(expected.material);
      expect(seo!.images).toEqual(expected.images);
      // The store carries pounds and this carries pence. They are the same
      // money or the PDP is lying about its price in one of two places.
      expect(seo!.pricePence).toBe(poundsToPence(expected.price));
    }
  });

  it("produces structured data whose price matches the page's, to the penny", async () => {
    const seo = await getPublishedProductSeo(demo[0].slug);
    const offers = productJsonLd("https://example.test", seo!).offers as Record<string, unknown>;

    expect(offers.price).toBe(demo[0].price.toFixed(2));
    expect(offers.priceCurrency).toBe("GBP");
  });

  it("returns null for an unknown slug rather than throwing", async () => {
    // The PDP layout renders no JSON-LD at all on this path, and the page shows
    // its own not-found. A throw here would 500 instead.
    expect(await getPublishedProductSeo("no-such-product")).toBeNull();
  });

  // Every other test here only reads. This one mutates a seeded row, so it runs
  // against a throwaway local stack only — on the shared remote project a
  // failure between the update and the restore would leave a real product
  // unpublished. `isLocal` is true in CI, which is where this needs to run.
  it.runIf(testEnv.isLocal)("does not return a product that is not published", async () => {
    const db = adminClient();
    const [victim] = demo;

    // Unpublish through the service-role client — RLS would stop the anonymous
    // one, which is the point — then confirm the public read loses it.
    const { error: hideError } = await db
      .from("products")
      .update({ status: "draft" })
      .eq("slug", victim.slug);
    expect(hideError).toBeNull();

    try {
      const products = await listPublishedProducts();
      expect(products.map((p) => p.slug)).not.toContain(victim.slug);
      expect(products).toHaveLength(demo.length - 1);
    } finally {
      // Restore whatever the outcome, so a failure here cannot leave the
      // database in a state that fails every later run.
      await db.from("products").update({ status: "published" }).eq("slug", victim.slug);
    }
  });
});
