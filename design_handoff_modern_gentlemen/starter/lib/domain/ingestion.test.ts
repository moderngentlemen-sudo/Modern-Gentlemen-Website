import { describe, expect, it } from "vitest";

import {
  assembleProduct,
  availabilityForStock,
  coerceValue,
  columnsForApply,
  decideAction,
  diffFields,
  FEED_TARGET_FIELDS,
  feedFieldMappingSchema,
  IMMUTABLE_AFTER_CREATE,
  isStageable,
  missingRequiredTargets,
  REQUIRED_TARGET_FIELDS,
  sourceStatusFor,
  xmlFeedConfigSchema,
  type NormalisedProduct,
} from "./ingestion";
import { contentHashOf } from "./contentHash";

const DEFAULTS = { fulfilment: "direct" as const, currency: "GBP" };

function product(overrides: Partial<NormalisedProduct> = {}): NormalisedProduct {
  return {
    external_id: "SKU-1",
    name: "Oxford Shoe",
    slug: "oxford-shoe",
    price_pence: 14_500,
    ...overrides,
  };
}

describe("target fields", () => {
  it("requires external_id and name, and nothing else", () => {
    expect(REQUIRED_TARGET_FIELDS).toEqual(["external_id", "name"]);
  });

  it("names the missing required targets rather than answering yes/no", () => {
    expect(missingRequiredTargets([{ target_field: "name" }])).toEqual(["external_id"]);
    expect(
      missingRequiredTargets([{ target_field: "name" }, { target_field: "external_id" }])
    ).toEqual([]);
  });

  it("treats slug alone as immutable after create", () => {
    expect(IMMUTABLE_AFTER_CREATE).toEqual(["slug"]);
  });

  it("offers no way to map status, and none to map the block tree", () => {
    expect(FEED_TARGET_FIELDS).not.toHaveProperty("status");
    expect(FEED_TARGET_FIELDS).not.toHaveProperty("draft_data");
    expect(FEED_TARGET_FIELDS).not.toHaveProperty("published_data");
  });
});

describe("feedFieldMappingSchema", () => {
  it("refuses a target that is not on the list", () => {
    const result = feedFieldMappingSchema.safeParse({
      target_field: "published_data",
      source_path: "x",
    });
    expect(result.success).toBe(false);
  });

  it("refuses an unknown transform", () => {
    const result = feedFieldMappingSchema.safeParse({
      target_field: "name",
      source_path: "title",
      transform: "shout",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a bare target/path pair and defaults the rest", () => {
    const result = feedFieldMappingSchema.parse({ target_field: "name", source_path: "title" });
    expect(result).toMatchObject({ transform: null, fallback: null, is_required: false });
  });
});

describe("coerceValue", () => {
  it("reads a whole number of pence", () => {
    expect(coerceValue("price_pence", "14500")).toEqual({ ok: true, value: 14_500 });
  });

  // The guard the whole file exists for: "145.00" is pounds, and reading it as
  // 145 pence would put a £145 jacket on the storefront at £1.45.
  it("refuses a decimal in a pence field and names the transform that fixes it", () => {
    const result = coerceValue("price_pence", "145.00");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("pounds_to_pence");
  });

  it("refuses a comma decimal too", () => {
    expect(coerceValue("price_pence", "145,00").ok).toBe(false);
  });

  it("refuses a negative price", () => {
    expect(coerceValue("price_pence", "-100").ok).toBe(false);
  });

  it("treats an empty string as absent rather than as a value", () => {
    expect(coerceValue("blurb", "   ")).toEqual({ ok: true, value: null });
  });

  it("normalises an availability the feed spelled its own way", () => {
    expect(coerceValue("availability", "Out Of Stock")).toEqual({
      ok: true,
      value: "out_of_stock",
    });
  });

  it("refuses an availability outside the vocabulary", () => {
    expect(coerceValue("availability", "backordered").ok).toBe(false);
  });

  it("refuses a multi-match for a single-valued target", () => {
    const result = coerceValue("name", ["One", "Two"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("more than one element");
  });

  it("keeps a multi-match for a list target", () => {
    expect(coerceValue("badges", ["NEW", "LIMITED"])).toEqual({
      ok: true,
      value: ["NEW", "LIMITED"],
    });
  });

  it("refuses a merchant URL that is not one", () => {
    expect(coerceValue("affiliate.merchant_url", "not a url").ok).toBe(false);
    expect(coerceValue("affiliate.merchant_url", "javascript:alert(1)").ok).toBe(false);
  });
});

describe("assembleProduct", () => {
  it("nests the affiliate fields", () => {
    const result = assembleProduct({
      external_id: "A",
      name: "Watch Roll",
      "affiliate.merchant_url": "https://example.com/p",
      "affiliate.merchant_name": "Example",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.affiliate).toEqual({
        merchant_url: "https://example.com/p",
        merchant_name: "Example",
      });
    }
  });

  it("derives the slug from the name when the feed carries none", () => {
    const result = assembleProduct({ external_id: "A", name: "The Coachbuilder's Floor" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.product.slug).toBe("the-coachbuilder-s-floor");
  });

  it("keeps a mapped slug in preference to the derived one", () => {
    const result = assembleProduct({ external_id: "A", name: "Watch Roll", slug: "custom-slug" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.product.slug).toBe("custom-slug");
  });

  it("fails a record with no name", () => {
    expect(assembleProduct({ external_id: "A" }).ok).toBe(false);
  });
});

describe("contentHashOf", () => {
  it("is stable across key order", () => {
    const a = contentHashOf({ external_id: "A", name: "N", slug: "n", price_pence: 100 });
    const b = contentHashOf({ price_pence: 100, slug: "n", name: "N", external_id: "A" });
    expect(a).toBe(b);
  });

  it("changes when a value changes", () => {
    expect(contentHashOf(product())).not.toBe(contentHashOf(product({ price_pence: 14_600 })));
  });

  it("distinguishes a nested change", () => {
    const withAffiliate = product({ affiliate: { merchant_name: "A" } });
    const changed = product({ affiliate: { merchant_name: "B" } });
    expect(contentHashOf(withAffiliate)).not.toBe(contentHashOf(changed));
  });
});

describe("decideAction", () => {
  it("creates when nothing is stored", () => {
    expect(decideAction(null, "abc")).toBe("create");
  });

  it("leaves an identical hash alone", () => {
    expect(decideAction({ content_hash: "abc" }, "abc")).toBe("unchanged");
  });

  it("updates when the hash differs", () => {
    expect(decideAction({ content_hash: "abc" }, "def")).toBe("update");
  });

  // A product imported before hashing existed has a null hash; it must be
  // reconsidered rather than assumed current.
  it("updates a stored product that has no hash", () => {
    expect(decideAction({ content_hash: null }, "abc")).toBe("update");
  });
});

describe("diffFields", () => {
  it("reports only what actually differs", () => {
    const changes = diffFields(
      { name: "Oxford Shoe", price_pence: 14_000, material: "Suede" },
      product()
    );
    expect(changes).toEqual([{ field: "price_pence", before: 14_000, after: 14_500 }]);
  });

  it("says nothing about a field the feed stopped sending", () => {
    const changes = diffFields(
      { name: "Oxford Shoe", price_pence: 14_500, material: "Suede" },
      product()
    );
    expect(changes.map((change) => change.field)).not.toContain("material");
  });

  it("never proposes a slug change, because an update will not write one", () => {
    const changes = diffFields({ name: "Oxford Shoe", slug: "old-slug" }, product());
    expect(changes.map((change) => change.field)).not.toContain("slug");
  });

  /**
   * `getProductForDiff` does not select `external_id` — it is the key the two
   * records were matched on, not a proposed change — so an unguarded diff
   * reports it as null → "SKU-1" on every single update. Caught by the test
   * above before this one existed; kept because the fix lives in a helper two
   * functions share, and a future edit to either could reintroduce it.
   */
  it("never proposes an external_id change", () => {
    const changes = diffFields({ name: "Oxford Shoe" }, product());
    expect(changes.map((change) => change.field)).not.toContain("external_id");
  });

  it("agrees with columnsForApply about which fields an update writes", () => {
    const before = { name: "Old name", slug: "old-slug", price_pence: 1 };
    const diffed = diffFields(before, product()).map((change) => change.field);
    const written = Object.keys(columnsForApply(product(), "update", DEFAULTS));
    expect(diffed.every((field) => written.includes(field))).toBe(true);
  });
});

describe("columnsForApply", () => {
  it("never writes status, on either path", () => {
    expect(columnsForApply(product(), "create", DEFAULTS)).not.toHaveProperty("status");
    expect(columnsForApply(product(), "update", DEFAULTS)).not.toHaveProperty("status");
  });

  it("writes the slug on create and not on update", () => {
    expect(columnsForApply(product(), "create", DEFAULTS)).toHaveProperty("slug", "oxford-shoe");
    expect(columnsForApply(product(), "update", DEFAULTS)).not.toHaveProperty("slug");
  });

  it("applies the source's fulfilment and currency only when creating", () => {
    expect(columnsForApply(product(), "create", DEFAULTS)).toMatchObject({
      fulfilment: "direct",
      currency: "GBP",
    });
    const updated = columnsForApply(product(), "update", DEFAULTS);
    expect(updated).not.toHaveProperty("fulfilment");
    expect(updated).not.toHaveProperty("currency");
  });

  it("does not write external_id as a column — the repository owns it", () => {
    expect(columnsForApply(product(), "create", DEFAULTS)).not.toHaveProperty("external_id");
  });

  it("carries the affiliate object through as one value", () => {
    const columns = columnsForApply(
      product({ affiliate: { merchant_url: "https://example.com/p" } }),
      "create",
      DEFAULTS
    );
    expect(columns.affiliate).toEqual({ merchant_url: "https://example.com/p" });
  });
});

describe("availabilityForStock", () => {
  it("derives out_of_stock from zero stock when the feed maps no availability", () => {
    expect(availabilityForStock(product({ stock: 0 }))).toBe("out_of_stock");
    expect(availabilityForStock(product({ stock: 4 }))).toBe("in_stock");
  });

  it("defers to a mapped availability", () => {
    expect(availabilityForStock(product({ stock: 0, availability: "preorder" }))).toBeUndefined();
  });

  it("says nothing when the feed maps neither", () => {
    expect(availabilityForStock(product())).toBeUndefined();
  });
});

describe("run outcome", () => {
  it("counts an all-failed run as failed, not partial", () => {
    expect(sourceStatusFor({ total: 3, created: 0, updated: 0, unchanged: 0, failed: 3 })).toBe(
      "failed"
    );
  });

  it("calls a run with some failures partial", () => {
    expect(sourceStatusFor({ total: 3, created: 2, updated: 0, unchanged: 0, failed: 1 })).toBe(
      "partial"
    );
  });

  it("calls a clean run ok", () => {
    expect(sourceStatusFor({ total: 3, created: 0, updated: 0, unchanged: 3, failed: 0 })).toBe(
      "ok"
    );
  });

  it("stages everything except the unchanged", () => {
    expect(isStageable("unchanged")).toBe(false);
    expect(isStageable("create")).toBe(true);
    expect(isStageable("update")).toBe(true);
    expect(isStageable("failed")).toBe(true);
  });
});

describe("xmlFeedConfigSchema", () => {
  it("refuses a non-http URL", () => {
    expect(
      xmlFeedConfigSchema.safeParse({ url: "file:///etc/passwd", item_path: "a/b" }).success
    ).toBe(false);
  });

  it("insists on an item path rather than guessing one", () => {
    expect(xmlFeedConfigSchema.safeParse({ url: "https://example.com/f.xml" }).success).toBe(false);
  });

  it("defaults fulfilment, currency and the timeout", () => {
    const config = xmlFeedConfigSchema.parse({
      url: "https://example.com/f.xml",
      item_path: "rss/channel/item",
    });
    expect(config).toMatchObject({ fulfilment: "direct", currency: "GBP", timeout_ms: 30_000 });
  });

  it("rejects an unknown key rather than storing it silently", () => {
    expect(
      xmlFeedConfigSchema.safeParse({
        url: "https://example.com/f.xml",
        item_path: "a/b",
        secret_token: "hunter2",
      }).success
    ).toBe(false);
  });
});
