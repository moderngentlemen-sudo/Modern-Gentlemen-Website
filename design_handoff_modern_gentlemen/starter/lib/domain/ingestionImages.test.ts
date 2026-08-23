import { describe, expect, it } from "vitest";

import {
  coerceValue,
  columnsForApply,
  imageFileNameFrom,
  imageImportPlan,
  APPLY_BATCH_SIZE,
  imageTypeProblem,
  MAX_IMAGE_DOWNLOADS_PER_RUN,
  MAX_IMAGES_PER_PRODUCT,
  normalisedProductSchema,
} from "./ingestion";

/**
 * Importing a feed's photographs. Everything here is the pure half — the fetch,
 * the upload and the `product_media` write live in `lib/services/ingestion.ts`
 * and are exercised only by CI.
 */

describe("coerceValue — images", () => {
  it("accepts a list of http(s) URLs", () => {
    expect(
      coerceValue("images", ["https://cdn.example/a.jpg", "http://cdn.example/b.png"])
    ).toEqual({
      ok: true,
      value: ["https://cdn.example/a.jpg", "http://cdn.example/b.png"],
    });
  });

  it("accepts a single URL as a one-image list", () => {
    // A feed with one photograph matches one node, so the adapter hands back a
    // string. That is the common case, not a malformed mapping.
    expect(coerceValue("images", "https://cdn.example/only.jpg")).toEqual({
      ok: true,
      value: ["https://cdn.example/only.jpg"],
    });
  });

  it("deduplicates, because a feed repeating an image would repeat it in the gallery", () => {
    const result = coerceValue("images", [
      "https://cdn.example/a.jpg",
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
    ]);
    expect(result).toEqual({
      ok: true,
      value: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    });
  });

  it("fails the whole item on one bad URL rather than importing a partial gallery", () => {
    // All-or-nothing on purpose: three of five photographs, with nothing saying
    // which two are missing, is worse than a refusal a reviewer can see.
    const result = coerceValue("images", ["https://cdn.example/a.jpg", "not a url"]);
    expect(result.ok).toBe(false);
  });

  it("refuses non-http protocols, which is the boundary that matters", () => {
    // These URLs are fetched by the *server* during apply. Without this check a
    // feed could point the importer at the local filesystem.
    for (const bad of [
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
      "ftp://cdn.example/a.jpg",
    ]) {
      expect(coerceValue("images", [bad]).ok, bad).toBe(false);
    }
  });

  it("treats an absent value as 'the feed did not supply this'", () => {
    expect(coerceValue("images", null)).toEqual({ ok: true, value: null });
    expect(coerceValue("images", "")).toEqual({ ok: true, value: null });
  });
});

describe("columnsForApply — images", () => {
  const product = normalisedProductSchema.parse({
    external_id: "SKU-1",
    name: "Field Chronometer",
    slug: "field-chronometer",
    price_pence: 14500,
    images: ["https://cdn.example/a.jpg"],
  });

  it("never copies images into a product column", () => {
    // The assertion that stops a clean-validating run failing at apply:
    // `products` has no `images` column, and `columnsForApply` copies every
    // field it is not told to skip.
    for (const action of ["create", "update"] as const) {
      const columns = columnsForApply(product, action, { fulfilment: "direct", currency: "GBP" });
      expect(columns, action).not.toHaveProperty("images");
    }
  });

  it("still carries the ordinary columns beside it", () => {
    const columns = columnsForApply(product, "create", { fulfilment: "direct", currency: "GBP" });
    expect(columns.name).toBe("Field Chronometer");
    expect(columns.price_pence).toBe(14500);
  });
});

describe("imageImportPlan", () => {
  const urls = Array.from({ length: 12 }, (_, i) => `https://cdn.example/${i}.jpg`);

  it("caps a pathological record at the per-product limit", () => {
    const plan = imageImportPlan(urls, { remaining: 100 });
    expect(plan.take).toHaveLength(MAX_IMAGES_PER_PRODUCT);
    expect(plan.skipped).toBe(urls.length - MAX_IMAGES_PER_PRODUCT);
  });

  it("stops at the run's remaining budget when that is the tighter of the two", () => {
    // The load-bearing cap: `applyJob` holds a server action open for its whole
    // duration, and images multiply that.
    const plan = imageImportPlan(urls, { remaining: 3 });
    expect(plan.take).toHaveLength(3);
    expect(plan.skipped).toBe(9);
  });

  it("takes nothing once the budget is spent, and reports the rest as skipped", () => {
    const plan = imageImportPlan(urls, { remaining: 0 });
    expect(plan.take).toEqual([]);
    expect(plan.skipped).toBe(12);
  });

  it("never reports a negative budget as capacity", () => {
    const plan = imageImportPlan(urls, { remaining: -5 });
    expect(plan.take).toEqual([]);
    expect(plan.skipped).toBe(12);
  });

  it("takes everything when both caps are comfortable", () => {
    const two = urls.slice(0, 2);
    expect(imageImportPlan(two, { remaining: 60 })).toEqual({ take: two, skipped: 0 });
  });
});

describe("imageFileNameFrom", () => {
  it("uses the URL's last path segment", () => {
    expect(imageFileNameFrom("https://cdn.example/photos/oxford-shoe.jpg")).toBe("oxford-shoe.jpg");
  });

  it("decodes percent-escapes and strips what a file name may not hold", () => {
    expect(imageFileNameFrom("https://cdn.example/a/Oxford%20Shoe%20(2).jpg")).toBe(
      "Oxford-Shoe-2-.jpg"
    );
  });

  it("never returns a traversal or a leading dot", () => {
    // Not a security boundary — `uploadAsset` generates the storage path — but
    // `../..` in a library listing is alarming whether or not it is exploitable.
    expect(imageFileNameFrom("https://cdn.example/../../etc/passwd")).not.toContain("..");
    expect(imageFileNameFrom("https://cdn.example/.hidden")).not.toMatch(/^\./);
  });

  it("falls back for a URL with no usable segment", () => {
    expect(imageFileNameFrom("https://cdn.example/")).toBe("image");
    expect(imageFileNameFrom("not a url")).toBe("image");
  });

  it("bounds the length", () => {
    const long = `https://cdn.example/${"a".repeat(400)}.jpg`;
    expect(imageFileNameFrom(long).length).toBeLessThanOrEqual(120);
  });
});

describe("imageTypeProblem", () => {
  it("accepts ordinary raster types and hands back the MIME to store", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) {
      expect(imageTypeProblem(mime, 1024), mime).toEqual({ ok: true, mimeType: mime });
    }
  });

  it("names an HTML error page for what it is", () => {
    // The failure this function exists for: a CDN answering an image URL with a
    // 200 and a login or error page. Refused everywhere, but only here is the
    // merchant told why.
    const result = imageTypeProblem("text/html", 4096);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problem).toMatch(/error page served as 200/);
  });

  it("refuses SVG, which is an image and also a script host", () => {
    // `media_assets` serves from a public bucket, so a merchant-controlled SVG
    // would be stored XSS on our own origin. A person uploading one through the
    // library has made a decision; a feed has not.
    const result = imageTypeProblem("image/svg+xml", 512);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problem).toMatch(/script/);
  });

  it("refuses an empty body and a missing content-type", () => {
    expect(imageTypeProblem("image/png", 0).ok).toBe(false);
    expect(imageTypeProblem(null, 1024).ok).toBe(false);
  });

  it("refuses other non-image types without pretending to know what they are", () => {
    for (const mime of ["application/json", "text/plain", "application/pdf", "video/mp4"]) {
      expect(imageTypeProblem(mime, 1024).ok, mime).toBe(false);
    }
  });
});

describe("APPLY_BATCH_SIZE", () => {
  it("is smaller than the run's image budget, so a batch cannot be image-bound", () => {
    // The two caps bound different things and must not fight. If a batch could
    // hold more items than the run has image downloads, the last items in every
    // batch would silently import no photographs while reporting success — the
    // budget message ("run apply again") would fire on every single batch.
    expect(APPLY_BATCH_SIZE).toBeLessThan(MAX_IMAGE_DOWNLOADS_PER_RUN);
  });

  it("is a positive whole number, because it slices an array", () => {
    expect(Number.isInteger(APPLY_BATCH_SIZE)).toBe(true);
    expect(APPLY_BATCH_SIZE).toBeGreaterThan(0);
  });
});
