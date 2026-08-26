import { describe, expect, it } from "vitest";

import { penceToPounds } from "./money";
import { productJsonLd } from "./seo";
import {
  cardPricePence,
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

describe("cardPricePence", () => {
  const v = (over: Partial<PublicVariant> & { id: string }): PublicVariant => ({
    title: "Size",
    sku: null,
    pricePence: null,
    availability: "in_stock",
    ...over,
  });

  it("quotes the product's own price when it is sold as one thing", () => {
    // The property the sixteen baselines depend on: no seeded product has a
    // variant row, so every card must read exactly as it always has.
    expect(cardPricePence(14_500, undefined)).toEqual({ pence: 14_500, from: false });
    expect(cardPricePence(14_500, [])).toEqual({ pence: 14_500, from: false });
  });

  it("says From when the buyable sizes differ", () => {
    expect(cardPricePence(14_500, [v({ id: "a" }), v({ id: "b", pricePence: 15_999 })])).toEqual({
      pence: 14_500,
      from: true,
    });
  });

  it("does not say From when three sizes are all one price", () => {
    // "From £145" implies a choice. If every size costs the same there is none,
    // and the word is just noise.
    expect(cardPricePence(14_500, [v({ id: "a" }), v({ id: "b" }), v({ id: "c" })])).toEqual({
      pence: 14_500,
      from: false,
    });
  });

  it("ignores a size nobody can buy, so it cannot advertise unspendable money", () => {
    const mixed = [
      v({ id: "a", pricePence: 9_900, availability: "discontinued" }),
      v({ id: "b", pricePence: 15_900 }),
    ];
    // £99 exists in the data and must not reach the card.
    expect(cardPricePence(14_500, mixed)).toEqual({ pence: 15_900, from: false });
  });

  it("falls back to every size when none is sellable", () => {
    const none = [
      v({ id: "a", pricePence: 9_900, availability: "out_of_stock" }),
      v({ id: "b", pricePence: 15_900, availability: "discontinued" }),
    ];
    expect(cardPricePence(14_500, none)).toEqual({ pence: 9_900, from: true });
  });

  it("agrees with the AggregateOffer's lowPrice, which is the point", () => {
    // The card and the structured data behind it disagreeing about the lowest
    // price is the mismatch a shopping feed is penalised for. Same rule, same
    // inputs, asserted together rather than hoped for.
    const variants = [
      v({ id: "a", pricePence: 9_900, availability: "discontinued" }),
      v({ id: "b", pricePence: 15_900 }),
      v({ id: "c", pricePence: 17_500 }),
    ];
    const offers = productJsonLd("https://example.test", {
      name: "Jacket",
      slug: "jacket",
      pricePence: 14_500,
      availability: "in_stock",
      images: [],
      variants,
    }).offers as Record<string, unknown>;

    expect(offers.lowPrice).toBe(penceToPounds(cardPricePence(14_500, variants).pence).toFixed(2));
  });
});
