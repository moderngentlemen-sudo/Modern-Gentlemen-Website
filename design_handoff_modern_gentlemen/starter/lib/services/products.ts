/**
 * Product service — the commerce metadata that sits outside the block tree.
 *
 * Everything a product shares with a page or an article already works, and this
 * time it genuinely needed one line of SQL rather than none: `documents.ts`
 * reads and saves the draft, `publishing.ts` publishes it through the same
 * transaction, `revisions.ts` rolls it back, and `0014` put 'product' on
 * `document_table()`'s allowlist so those functions can resolve it at all.
 *
 * What is left is the part of a product that is *not* a block tree: what it
 * costs, whether there is any, who fulfils it, and what it is filed under.
 * That is this file.
 *
 * Note what is deliberately absent: a delete. Deleting a product goes through
 * `documents.deleteDocument("product", id)` like every other document type,
 * because that is the function that clears the stranded `media_usages` rows
 * (`media_usages.entity_id` has no foreign key — see the 0002 header). A
 * bespoke product delete here would compile, work, and quietly make every asset
 * the product used permanently undeletable.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/products";
import { RepositoryError } from "@/lib/db/repositories/errors";
import type {
  ProductAvailability,
  ProductFulfilment,
  ProductMediaRole,
} from "@/lib/domain/products";
import { requirePermission } from "./auth";

export type ProductMeta = repo.ProductMetaRow;
export type ProductVariant = repo.ProductVariantRow;
export type ProductMedia = repo.ProductMediaRow;
export type Collection = repo.CollectionRow;

export async function getProductMeta(id: string): Promise<ProductMeta | null> {
  await requirePermission("product.read");
  const db = await createClient();
  return repo.getProductMeta(db, id);
}

/**
 * `slug` is unique, so a collision comes back as 23505. Left alone that reaches
 * an editor as a raw constraint string; translated here it reads as the thing
 * they actually did. The same treatment `createArticle` and `renamePage` give it.
 */
export async function createProduct(input: {
  name: string;
  slug: string;
  fulfilment?: ProductFulfilment;
}): Promise<{ id: string }> {
  const user = await requirePermission("product.write");
  const db = await createClient();

  try {
    return await repo.createProduct(db, { ...input, createdBy: user.id });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${input.slug}" is already in use by another product.`);
    }
    throw error;
  }
}

export async function updateProductMeta(
  id: string,
  patch: Omit<repo.ProductMetaPatch, "updatedBy">
): Promise<ProductMeta> {
  const user = await requirePermission("product.write");
  const db = await createClient();

  try {
    return await repo.updateProductMeta(db, id, { ...patch, updatedBy: user.id });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${patch.slug}" is already in use by another product.`);
    }
    // 23514 is the `affiliate_needs_merchant_url` CHECK. `productMetaSchema`
    // catches this first and points at the control, so reaching here means
    // something bypassed the form — still worth a sentence an editor can read.
    if (error instanceof RepositoryError && error.code === "23514") {
      throw new Error("An affiliate product needs the merchant URL it links out to.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  await requirePermission("product.read");
  const db = await createClient();
  return repo.listVariants(db, productId);
}

export async function createVariant(input: {
  productId: string;
  title: string;
  sku?: string | null;
  pricePence?: number | null;
  stock?: number;
  position?: number;
}): Promise<{ id: string }> {
  await requirePermission("product.write");
  const db = await createClient();
  return repo.createVariant(db, input);
}

export async function updateVariant(
  id: string,
  patch: {
    title?: string;
    sku?: string | null;
    pricePence?: number | null;
    stock?: number;
    availability?: ProductAvailability;
    position?: number;
  }
): Promise<void> {
  await requirePermission("product.write");
  const db = await createClient();
  await repo.updateVariant(db, id, patch);
}

export async function deleteVariant(id: string): Promise<void> {
  // `product.write`, not `product.delete`. Removing a size is editing the
  // product; `product.delete` is for removing the product itself, and the RLS
  // policy on `product_variants` agrees — it gates all writes on product.write.
  await requirePermission("product.write");
  const db = await createClient();
  await repo.deleteVariant(db, id);
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export async function listProductMedia(productId: string): Promise<ProductMedia[]> {
  await requirePermission("product.read");
  const db = await createClient();
  return repo.listProductMedia(db, productId);
}

export async function attachProductMedia(
  productId: string,
  input: { assetId: string; role?: ProductMediaRole; position?: number }
): Promise<void> {
  await requirePermission("product.write");
  const db = await createClient();
  await repo.attachProductMedia(db, productId, input);
}

export async function detachProductMedia(productId: string, assetId: string): Promise<void> {
  await requirePermission("product.write");
  const db = await createClient();
  await repo.detachProductMedia(db, productId, assetId);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function listCollections(): Promise<Collection[]> {
  await requirePermission("product.read");
  const db = await createClient();
  return repo.listCollections(db);
}

export async function createCollection(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<{ id: string }> {
  await requirePermission("product.write");
  const db = await createClient();

  try {
    return await repo.createCollection(db, input);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${input.slug}" is already in use by another collection.`);
    }
    throw error;
  }
}

export async function updateCollection(
  id: string,
  patch: { name?: string; slug?: string; description?: string | null; position?: number }
): Promise<void> {
  await requirePermission("product.write");
  const db = await createClient();

  try {
    await repo.updateCollection(db, id, patch);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${patch.slug}" is already in use by another collection.`);
    }
    throw error;
  }
}

/**
 * Deleting a collection is `product.delete` — it is the removal of a thing,
 * not an edit to one. `product_collection_items` cascades, so the products it
 * held are untouched and simply stop being listed under it.
 */
export async function deleteCollection(id: string): Promise<void> {
  await requirePermission("product.delete");
  const db = await createClient();
  await repo.deleteCollection(db, id);
}

export async function getProductCollectionIds(productId: string): Promise<string[]> {
  await requirePermission("product.read");
  const db = await createClient();
  return repo.collectionIdsForProduct(db, productId);
}

export async function setProductCollections(
  productId: string,
  collectionIds: string[]
): Promise<void> {
  await requirePermission("product.write");
  const db = await createClient();
  await repo.setProductCollections(db, productId, collectionIds);
}
