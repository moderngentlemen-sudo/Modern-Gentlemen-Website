/**
 * Product galleries as asset references, against a real Postgres.
 *
 * `lib/services/media.ts#deleteAsset` refuses to delete an asset something is
 * still using, and it used to decide that from `media_usages` alone. A gallery
 * is `product_media` — a different table, written directly by the products
 * admin and never walked by the reconciliation that fills `media_usages`. So an
 * asset could be the hero photograph on six product pages and read as entirely
 * unreferenced.
 *
 * The two assertions below are the ones a unit test cannot make, because the
 * danger is a property of the schema rather than of any function:
 *
 *   1. `productsForAsset` finds the products a gallery row points at — the
 *      query the refusal now depends on;
 *   2. deleting the asset **cascades** the gallery rows away, which is why
 *      under-counting was destructive rather than merely untidy.
 *
 * Fixtures are created here rather than assumed from the seed, so this runs on
 * any database with the migrations applied.
 *
 * Requires a stack — CI starts one (`.github/workflows/ci.yml`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { productsForAsset } from "@/lib/db/repositories/products";
import { galleryReferences } from "@/lib/domain/media";
import { adminClient, prefixed } from "../support/fixtures";

const db = adminClient();

let assetId = "";
let productId = "";

beforeAll(async () => {
  const slug = prefixed("gallery-product");

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .insert({
      bucket: "media",
      storage_path: `${slug}.png`,
      kind: "image",
      mime_type: "image/png",
      file_name: `${slug}.png`,
      byte_size: 70,
    })
    .select("id")
    .single();
  if (assetError) throw new Error(`fixture asset: ${assetError.message}`);
  assetId = asset.id;

  const { data: product, error: productError } = await db
    .from("products")
    .insert({ slug, name: "Fixture product" })
    .select("id")
    .single();
  if (productError) throw new Error(`fixture product: ${productError.message}`);
  productId = product.id;
}, 60_000);

afterAll(async () => {
  // The asset goes first deliberately — the cascade takes `product_media` with
  // it, and the product row is then free of references.
  if (assetId) await db.from("media_assets").delete().eq("id", assetId);
  if (productId) await db.from("products").delete().eq("id", productId);
});

describe("a product gallery as an asset reference", () => {
  it("reports no products before anything is attached", async () => {
    expect(await productsForAsset(db, assetId)).toEqual([]);
  });

  it("finds the product once the asset is in its gallery", async () => {
    const { error } = await db
      .from("product_media")
      .insert({ product_id: productId, asset_id: assetId, position: 0, role: "primary" });
    expect(error).toBeNull();

    const rows = await productsForAsset(db, assetId);
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id).toBe(productId);

    // The shape `deleteAsset` actually refuses on, and the panel renders.
    expect(galleryReferences(rows.map((r) => r.product_id))).toEqual([
      {
        id: `gallery:${productId}`,
        entityType: "product",
        entityId: productId,
        fieldPath: "gallery",
      },
    ]);
  });

  it("writes no media_usages row — which is the whole problem", async () => {
    // If this ever starts returning a row, gallery reconciliation has been
    // added somewhere and the separate check in `deleteAsset` is redundant
    // rather than load-bearing. Worth knowing either way.
    const { data, error } = await db.from("media_usages").select("id").eq("asset_id", assetId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("stops finding the product once the gallery row is detached", async () => {
    const { error } = await db
      .from("product_media")
      .delete()
      .eq("product_id", productId)
      .eq("asset_id", assetId);
    expect(error).toBeNull();

    expect(await productsForAsset(db, assetId)).toEqual([]);
  });

  it("cascades the gallery row away when the asset is deleted", async () => {
    // Re-attach, then delete the asset out from under it. This is the damage
    // the refusal prevents: the database removes the gallery row without
    // complaint, and the product silently loses a photograph. Nothing here is
    // a bug — `on delete cascade` is correct — but it is why the delete has to
    // ask first.
    await db
      .from("product_media")
      .insert({ product_id: productId, asset_id: assetId, position: 0, role: "primary" });
    expect(await productsForAsset(db, assetId)).toHaveLength(1);

    const { error } = await db.from("media_assets").delete().eq("id", assetId);
    expect(error).toBeNull();

    const { data } = await db.from("product_media").select("asset_id").eq("product_id", productId);
    expect(data).toEqual([]);

    // Already gone; stop afterAll from reporting a second delete.
    assetId = "";
  });
});
