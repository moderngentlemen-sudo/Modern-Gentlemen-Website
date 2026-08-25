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

  /**
   * The variant read, against a real stack and the real anonymous policies.
   *
   * Two things need proving and neither can be proved in a unit test. First
   * that `0019`'s parent-status policy lets an anonymous caller read the
   * variants of a *published* product at all — the embedded select returns an
   * empty array rather than an error when a policy refuses, so a broken policy
   * looks exactly like a product with no sizes. Second that the seeded
   * catalogue still carries none, which is the fact the sixteen visual
   * baselines rest on: the picker renders only when variants exist.
   */
  it("carries no variants for the seeded catalogue, which is what keeps the picker additive", async () => {
    const products = await listPublishedProducts();

    for (const product of products) {
      // Absent, not empty. `Product.variants` is optional so that the
      // field-by-field comparison above stays a real assertion.
      expect(product.variants).toBeUndefined();
    }
  });

  // Inserts rows, so it follows this file's existing rule for anything that
  // mutates: a throwaway local stack only. `isLocal` is true in CI, which is
  // where it needs to run. On the shared remote project a failure between the
  // insert and the cleanup would leave a probe variant showing on a live PDP —
  // and unlike the unpublish test below, this one would be *visible to
  // shoppers* rather than merely wrong.
  it.runIf(testEnv.isLocal)(
    "returns a published product's variants to an anonymous reader",
    async () => {
      // Written directly rather than through the service because the admin path
      // needs a session; the read below is the anonymous one under RLS, which is
      // the half at risk.
      const db = adminClient();
      const target = demo[0];

      const { data: product } = await db
        .from("products")
        .select("id")
        .eq("slug", target.slug)
        .single();

      const { data: inserted, error } = await db
        .from("product_variants")
        .insert([
          { product_id: product!.id, title: "zz-probe-large", price_pence: 15_999, position: 1 },
          { product_id: product!.id, title: "zz-probe-small", price_pence: null, position: 0 },
        ])
        .select("id");

      expect(error).toBeNull();

      try {
        const read = await listPublishedProducts();
        const found = read.find((p) => p.slug === target.slug);

        // Ordered by position, not by insertion: the picker's leftmost option is
        // the merchant's first, and PostgREST's embedded ordering fails soft.
        expect(found?.variants?.map((v) => v.title)).toEqual(["zz-probe-small", "zz-probe-large"]);
        expect(found?.variants?.map((v) => v.pricePence)).toEqual([null, 15_999]);
        // `stock` is never selected, so it cannot reach a browser.
        expect(found?.variants?.[0]).not.toHaveProperty("stock");
      } finally {
        // The project is shared with a live human — every probe row goes away,
        // and the `zz-` prefix is what keeps it distinguishable meanwhile.
        await db
          .from("product_variants")
          .delete()
          .in(
            "id",
            (inserted ?? []).map((row) => row.id)
          );
      }
    }
  );

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

  it("reads the variant rows structured data prices from", async () => {
    // The whole seeded catalogue is variant-free, so this asserts the *shape*
    // rather than a count: the field is present and empty, and the JSON-LD
    // therefore still takes the single-Offer branch the sixteen baselines and
    // the live site's structured data were captured under. The day a product
    // gains a size, this read is what carries it into the `<head>`.
    const seo = await getPublishedProductSeo(demo[0].slug);

    expect(seo!.variants).toEqual([]);
    expect(
      (productJsonLd("https://example.test", seo!).offers as Record<string, unknown>)["@type"]
    ).toBe("Offer");
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
