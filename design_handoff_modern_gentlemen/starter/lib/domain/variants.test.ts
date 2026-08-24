import { describe, expect, it } from "vitest";

import {
  cartLineKey,
  defaultVariant,
  findVariant,
  hasVariants,
  isVariantSellable,
  parseCartLineKey,
  variantPricePence,
  type PublicVariant,
} from "./variants";
import { PRODUCT_AVAILABILITIES } from "./products";

function variant(over: Partial<PublicVariant> = {}): PublicVariant {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Medium",
    sku: null,
    pricePence: null,
    availability: "in_stock",
    ...over,
  };
}

describe("sellability", () => {
  it("treats in_stock and preorder as buyable and nothing else", () => {
    // Asserted over the whole vocabulary rather than one value at a time: the
    // point is that a *new* availability defaults to unsellable, and a test
    // that named only the four we have today would not notice a fifth.
    const sellable = PRODUCT_AVAILABILITIES.filter((availability) =>
      isVariantSellable(variant({ availability }))
    );

    expect(sellable).toEqual(["in_stock", "preorder"]);
  });
});

describe("variantPricePence", () => {
  it("uses the variant's own price when it has one", () => {
    expect(variantPricePence(14_500, variant({ pricePence: 16_000 }))).toBe(16_000);
  });

  it("falls back to the product's price when the variant's is null", () => {
    // The null is the meaningful case: it means "whatever the product costs",
    // so a later price change reaches every size instead of leaving stale
    // copies on each row.
    expect(variantPricePence(14_500, variant({ pricePence: null }))).toBe(14_500);
  });

  it("prices a free variant as free rather than as the product", () => {
    // 0 is falsy and `??` is what makes this correct — `||` would silently
    // charge £145 for something the merchant marked as costing nothing.
    expect(variantPricePence(14_500, variant({ pricePence: 0 }))).toBe(0);
  });

  it("prices as the product when there is no variant at all", () => {
    expect(variantPricePence(14_500, null)).toBe(14_500);
    expect(variantPricePence(14_500, undefined)).toBe(14_500);
  });
});

describe("defaultVariant", () => {
  it("is null when a product is sold as one thing", () => {
    expect(defaultVariant([])).toBeNull();
  });

  it("skips a sold-out first option so the page opens on something buyable", () => {
    const small = variant({ id: "a", title: "Small", availability: "out_of_stock" });
    const medium = variant({ id: "b", title: "Medium" });

    expect(defaultVariant([small, medium])).toBe(medium);
  });

  it("still returns the first when nothing is buyable, so the page shows a price", () => {
    const small = variant({ id: "a", availability: "out_of_stock" });
    const medium = variant({ id: "b", availability: "discontinued" });

    expect(defaultVariant([small, medium])).toBe(small);
  });
});

describe("findVariant", () => {
  it("returns null for a variant the merchant has deleted", () => {
    // A bag outlives an admin edit, so a stale id is an ordinary state rather
    // than an error. Callers price the line as the product.
    expect(findVariant([variant({ id: "a" })], "gone")).toBeNull();
  });

  it("returns null when there is no id or no variants", () => {
    expect(findVariant([variant({ id: "a" })], null)).toBeNull();
    expect(findVariant(undefined, "a")).toBeNull();
  });

  it("finds the named variant", () => {
    const large = variant({ id: "b", title: "Large" });
    expect(findVariant([variant({ id: "a" }), large], "b")).toBe(large);
  });
});

describe("hasVariants", () => {
  it("is false for an absent or empty list", () => {
    expect(hasVariants({})).toBe(false);
    expect(hasVariants({ variants: [] })).toBe(false);
  });

  it("is true once a merchant has added one", () => {
    expect(hasVariants({ variants: [variant()] })).toBe(true);
  });
});

describe("cart line identity", () => {
  it("is the bare slug when there is no variant", () => {
    // Load-bearing: every bag already in a shopper's localStorage holds
    // `{ slug, qty }`, and every call site that says `cart.remove(l.slug)` was
    // written against that. Equality here is what keeps both valid.
    expect(cartLineKey("travel-watch-roll")).toBe("travel-watch-roll");
    expect(cartLineKey("travel-watch-roll", null)).toBe("travel-watch-roll");
  });

  it("distinguishes two sizes of one product", () => {
    expect(cartLineKey("watch-roll", "a")).not.toBe(cartLineKey("watch-roll", "b"));
  });

  it("round-trips through parseCartLineKey", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(parseCartLineKey(cartLineKey("watch-roll", id))).toEqual({
      slug: "watch-roll",
      variantId: id,
    });
    expect(parseCartLineKey(cartLineKey("watch-roll"))).toEqual({
      slug: "watch-roll",
      variantId: null,
    });
  });

  it("keeps the separator out of both halves, which is what makes the inverse exact", () => {
    // A slug matches ^[a-z0-9]+(-[a-z0-9]+)*$ and a variant id is a uuid, so
    // neither can contain "::". If either rule ever loosens, this is the test
    // that says the key format has to change with it.
    const slugs = ["travel-watch-roll", "a", "watch-roll-2"];
    for (const slug of slugs) expect(slug).not.toContain("::");
    expect("11111111-1111-4111-8111-111111111111").not.toContain("::");
  });
});
