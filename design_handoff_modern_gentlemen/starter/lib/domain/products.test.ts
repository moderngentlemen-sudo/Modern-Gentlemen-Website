import { describe, expect, it } from "vitest";

import { products as demoProducts } from "@/lib/catalog";
import { poundsToPence } from "./money";
import {
  affiliateSchema,
  isProductAvailability,
  isProductFulfilment,
  PRODUCT_BADGES,
  productMetaSchema,
  productSpecsSchema,
  tracksStock,
} from "./products";

/**
 * A valid direct product, spread into each case so a test names only the field
 * it is about. Every amount is integer pence.
 */
const DIRECT = {
  name: "Travel Watch Roll, Waxed Canvas",
  slug: "travel-watch-roll",
  fulfilment: "direct",
  availability: "in_stock",
  price_pence: 14_500,
  compare_at_pence: null,
  stock: 12,
  track_inventory: true,
  badges: ["NEW"],
  specs: [["Capacity", "3 watches, up to 44mm"]],
  affiliate: {},
} as const;

describe("product vocabularies", () => {
  it("recognises the real values and rejects anything else", () => {
    expect(isProductFulfilment("affiliate")).toBe(true);
    expect(isProductFulfilment("Affiliate")).toBe(false);
    expect(isProductAvailability("preorder")).toBe(true);
    expect(isProductAvailability("backordered")).toBe(false);
  });
});

/**
 * Conformance between the typed vocabulary and the demo catalogue it will
 * eventually replace. The same argument `articles.test.ts` makes: two lists
 * that must agree, kept apart on purpose, so a test is what holds them in step.
 *
 * This matters more than it looks. Phase 7 rewires the store to read these rows
 * from the database, and anything the demo catalogue holds that the schema
 * cannot represent is a migration that silently drops content.
 */
describe("conformance with the demo catalogue", () => {
  it("has a badge for every tag the catalogue actually uses", () => {
    const used = new Set(demoProducts.map((product) => product.tag).filter(Boolean));
    expect([...used].sort()).toEqual([...PRODUCT_BADGES].filter((badge) => used.has(badge)).sort());
    for (const tag of used) {
      expect(PRODUCT_BADGES).toContain(tag);
    }
  });

  it("accepts every demo spec table", () => {
    for (const product of demoProducts) {
      const result = productSpecsSchema.safeParse(product.specs);
      expect(result.success, `${product.slug} specs`).toBe(true);
    }
  });

  it("accepts every demo slug", () => {
    for (const product of demoProducts) {
      const result = productMetaSchema.safeParse({ ...DIRECT, slug: product.slug });
      expect(result.success, `${product.slug}`).toBe(true);
    }
  });

  it("converts every demo price to whole pence without loss", () => {
    for (const product of demoProducts) {
      const pence = poundsToPence(product.price);
      expect(Number.isInteger(pence), `${product.slug}`).toBe(true);
      expect(pence).toBe(product.price * 100);
    }
  });
});

describe("productMetaSchema", () => {
  it("accepts a well-formed direct product", () => {
    expect(productMetaSchema.safeParse(DIRECT).success).toBe(true);
  });

  it("rejects a slug that is not one", () => {
    for (const slug of ["Travel Watch Roll", "travel_watch_roll", "-leading", "trailing-"]) {
      expect(productMetaSchema.safeParse({ ...DIRECT, slug }).success, slug).toBe(false);
    }
  });

  it("requires a merchant URL on an affiliate product, and points at the field", () => {
    const result = productMetaSchema.safeParse({ ...DIRECT, fulfilment: "affiliate" });
    expect(result.success).toBe(false);

    // The path is what lets the form focus the offending control. `lib/blocks`
    // went to real trouble to keep issue paths precise; the same applies here.
    expect(result.success === false && result.error.issues[0].path).toEqual([
      "affiliate",
      "merchant_url",
    ]);
  });

  it("accepts an affiliate product that has one", () => {
    const result = productMetaSchema.safeParse({
      ...DIRECT,
      fulfilment: "affiliate",
      affiliate: { merchant_url: "https://example.com/watch-roll", merchant_name: "Example" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a compare-at price that is not a reduction", () => {
    // Equal is the interesting case: it renders as a struck-through identical
    // number, which reads as a bug rather than a price.
    for (const compare_at_pence of [14_500, 9_900]) {
      const result = productMetaSchema.safeParse({ ...DIRECT, compare_at_pence });
      expect(result.success, String(compare_at_pence)).toBe(false);
    }
    expect(productMetaSchema.safeParse({ ...DIRECT, compare_at_pence: 19_900 }).success).toBe(true);
  });

  it("rejects fractional money — pence are integers", () => {
    expect(productMetaSchema.safeParse({ ...DIRECT, price_pence: 145.5 }).success).toBe(false);
  });

  it("rejects negative stock and negative prices", () => {
    expect(productMetaSchema.safeParse({ ...DIRECT, stock: -1 }).success).toBe(false);
    expect(productMetaSchema.safeParse({ ...DIRECT, price_pence: -1 }).success).toBe(false);
  });
});

describe("affiliateSchema", () => {
  it("rejects a merchant URL that is not a URL", () => {
    // The database's `affiliate ? 'merchant_url'` check passes on any present
    // key, including a null one. This is the check that means something.
    expect(affiliateSchema.safeParse({ merchant_url: "example.com" }).success).toBe(false);
    expect(affiliateSchema.safeParse({ merchant_url: null }).success).toBe(false);
    expect(affiliateSchema.safeParse({ merchant_url: "https://example.com" }).success).toBe(true);
  });

  it("rejects an undeclared key", () => {
    // Strict, like `strictSchema` in lib/blocks: an unexpected key in a jsonb
    // column nearly always means something wrote a shape nothing reads.
    expect(affiliateSchema.safeParse({ commission: 0.1 }).success).toBe(false);
  });

  it("accepts an empty object — the column default", () => {
    expect(affiliateSchema.safeParse({}).success).toBe(true);
  });
});

describe("tracksStock", () => {
  it("is true only for a direct product that opted in", () => {
    expect(tracksStock({ fulfilment: "direct", track_inventory: true })).toBe(true);
    expect(tracksStock({ fulfilment: "direct", track_inventory: false })).toBe(false);
    // An affiliate product's stock column is meaningless — the merchant holds
    // the inventory — so the flag does not get to override it.
    expect(tracksStock({ fulfilment: "affiliate", track_inventory: true })).toBe(false);
  });
});
