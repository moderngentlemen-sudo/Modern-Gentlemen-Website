/**
 * Product creation and the product-shaped columns.
 *
 * Everything a product shares with the other versioned entities — drafts,
 * versions, status, history, publishing — is served by `documents.ts` and needs
 * nothing here, now that `0014` has put 'product' on the `document_table()`
 * allowlist. This file holds only what is genuinely product-shaped: the
 * commerce columns that sit outside the block tree, the variants, the gallery
 * join and collection membership.
 *
 * The same split `articles.ts` and `pages.ts` make, for the same reason.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProductAvailability,
  ProductFulfilment,
  ProductMediaRole,
} from "@/lib/domain/products";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

/**
 * An empty product. Two keys, matching the column default in `0005`: `sections`
 * is the block tree the builder edits (`BLOCK_TREE_KEY.product`), and `seo` is
 * carried through untouched by every save — the builder route strips the tree
 * key out and puts the rest back, so nothing it does not understand is lost.
 */
export const EMPTY_PRODUCT_PAYLOAD: Json = { sections: [], seo: {} };

/** The columns that are not the document. */
export interface ProductMetaRow {
  id: string;
  slug: string;
  name: string;
  cat: string | null;
  cat_label: string | null;
  sku: string | null;
  blurb: string | null;
  story: string | null;
  material: string | null;
  fulfilment: ProductFulfilment;
  price_pence: number;
  compare_at_pence: number | null;
  currency: string;
  stock: number;
  track_inventory: boolean;
  availability: ProductAvailability;
  badges: string[];
  specs: Json;
  affiliate: Json;
  position: number;
  source_id: string | null;
  external_id: string | null;
}

const META_COLUMNS =
  "id, slug, name, cat, cat_label, sku, blurb, story, material, fulfilment, " +
  "price_pence, compare_at_pence, currency, stock, track_inventory, availability, " +
  "badges, specs, affiliate, position, source_id, external_id";

export async function createProduct(
  db: Db,
  input: { slug: string; name: string; fulfilment?: ProductFulfilment; createdBy: string }
): Promise<{ id: string }> {
  return unwrap(
    "createProduct",
    await db
      .from("products")
      .insert({
        slug: input.slug,
        name: input.name,
        // The column defaults to 'direct'; naming it explicitly keeps the
        // create dialog and the database from disagreeing about the default.
        fulfilment: input.fulfilment ?? "direct",
        draft_data: EMPTY_PRODUCT_PAYLOAD,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select("id")
      .single()
  ) as { id: string };
}

export async function getProductMeta(db: Db, id: string): Promise<ProductMetaRow | null> {
  return (
    (unwrap(
      "getProductMeta",
      await db.from("products").select(META_COLUMNS).eq("id", id).maybeSingle()
    ) as ProductMetaRow | null) ?? null
  );
}

export interface ProductMetaPatch {
  name?: string;
  slug?: string;
  cat?: string | null;
  catLabel?: string | null;
  sku?: string | null;
  blurb?: string | null;
  story?: string | null;
  material?: string | null;
  fulfilment?: ProductFulfilment;
  pricePence?: number;
  compareAtPence?: number | null;
  stock?: number;
  trackInventory?: boolean;
  availability?: ProductAvailability;
  badges?: string[];
  specs?: Json;
  affiliate?: Json;
  position?: number;
  updatedBy: string;
}

/**
 * Only the keys the caller supplied are written — the same rule the article and
 * media metadata patches follow, and for the same reason: an absent key and a
 * cleared one are different intentions, and a form that sends six fields must
 * not blank the four it does not show.
 */
export async function updateProductMeta(
  db: Db,
  id: string,
  patch: ProductMetaPatch
): Promise<ProductMetaRow> {
  const update: Database["public"]["Tables"]["products"]["Update"] = {
    updated_by: patch.updatedBy,
  };

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.slug !== undefined) update.slug = patch.slug;
  if (patch.cat !== undefined) update.cat = patch.cat;
  if (patch.catLabel !== undefined) update.cat_label = patch.catLabel;
  if (patch.sku !== undefined) update.sku = patch.sku;
  if (patch.blurb !== undefined) update.blurb = patch.blurb;
  if (patch.story !== undefined) update.story = patch.story;
  if (patch.material !== undefined) update.material = patch.material;
  if (patch.fulfilment !== undefined) update.fulfilment = patch.fulfilment;
  if (patch.pricePence !== undefined) update.price_pence = patch.pricePence;
  if (patch.compareAtPence !== undefined) update.compare_at_pence = patch.compareAtPence;
  if (patch.stock !== undefined) update.stock = patch.stock;
  if (patch.trackInventory !== undefined) update.track_inventory = patch.trackInventory;
  if (patch.availability !== undefined) update.availability = patch.availability;
  if (patch.badges !== undefined) update.badges = patch.badges;
  if (patch.specs !== undefined) update.specs = patch.specs;
  if (patch.affiliate !== undefined) update.affiliate = patch.affiliate;
  if (patch.position !== undefined) update.position = patch.position;

  return unwrap(
    "updateProductMeta",
    await db.from("products").update(update).eq("id", id).select(META_COLUMNS).single()
  ) as ProductMetaRow;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export interface ProductVariantRow {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  options: Json;
  price_pence: number | null;
  stock: number;
  availability: ProductAvailability;
  position: number;
}

const VARIANT_COLUMNS =
  "id, product_id, title, sku, options, price_pence, stock, availability, position";

export async function listVariants(db: Db, productId: string): Promise<ProductVariantRow[]> {
  return (unwrap(
    "listVariants",
    await db
      .from("product_variants")
      .select(VARIANT_COLUMNS)
      .eq("product_id", productId)
      .order("position", { ascending: true })
  ) ?? []) as ProductVariantRow[];
}

/**
 * `price_pence` is nullable on a variant, and that null is meaningful: it means
 * "whatever the product costs". Writing the product's price onto every variant
 * instead would fork one number into as many rows as there are sizes, and a
 * later price change would update one of them.
 */
export async function createVariant(
  db: Db,
  input: {
    productId: string;
    title: string;
    sku?: string | null;
    pricePence?: number | null;
    stock?: number;
    position?: number;
  }
): Promise<{ id: string }> {
  return unwrap(
    "createVariant",
    await db
      .from("product_variants")
      .insert({
        product_id: input.productId,
        title: input.title,
        sku: input.sku ?? null,
        price_pence: input.pricePence ?? null,
        stock: input.stock ?? 0,
        position: input.position ?? 0,
      })
      .select("id")
      .single()
  ) as { id: string };
}

export async function updateVariant(
  db: Db,
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
  const update: Database["public"]["Tables"]["product_variants"]["Update"] = {};

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.sku !== undefined) update.sku = patch.sku;
  if (patch.pricePence !== undefined) update.price_pence = patch.pricePence;
  if (patch.stock !== undefined) update.stock = patch.stock;
  if (patch.availability !== undefined) update.availability = patch.availability;
  if (patch.position !== undefined) update.position = patch.position;

  unwrap("updateVariant", await db.from("product_variants").update(update).eq("id", id));
}

export async function deleteVariant(db: Db, id: string): Promise<void> {
  unwrap("deleteVariant", await db.from("product_variants").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface ProductMediaRow {
  asset_id: string;
  position: number;
  role: ProductMediaRole;
}

/**
 * A product's gallery is a real join onto `media_assets`, not a list of URLs.
 *
 * This is the `featured_asset_id` stance from Phase 5b rather than the block
 * field one: `product_media.asset_id` carries a foreign key with `on delete
 * cascade`, so referential integrity is the database's problem and the gallery
 * cannot outlive its assets. A block's `image` field still holds a URL, because
 * a block has to keep working when it points at a CDN the library does not own.
 */
export async function listProductMedia(db: Db, productId: string): Promise<ProductMediaRow[]> {
  return (unwrap(
    "listProductMedia",
    await db
      .from("product_media")
      .select("asset_id, position, role")
      .eq("product_id", productId)
      .order("position", { ascending: true })
  ) ?? []) as ProductMediaRow[];
}

export async function attachProductMedia(
  db: Db,
  productId: string,
  input: { assetId: string; role?: ProductMediaRole; position?: number }
): Promise<void> {
  unwrap(
    "attachProductMedia",
    await db.from("product_media").upsert(
      {
        product_id: productId,
        asset_id: input.assetId,
        role: input.role ?? "gallery",
        position: input.position ?? 0,
      },
      { onConflict: "product_id,asset_id" }
    )
  );
}

export async function detachProductMedia(
  db: Db,
  productId: string,
  assetId: string
): Promise<void> {
  unwrap(
    "detachProductMedia",
    await db.from("product_media").delete().eq("product_id", productId).eq("asset_id", assetId)
  );
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface CollectionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
}

const COLLECTION_COLUMNS = "id, slug, name, description, position, status";

export async function listCollections(db: Db): Promise<CollectionRow[]> {
  return (unwrap(
    "listCollections",
    await db
      .from("product_collections")
      .select(COLLECTION_COLUMNS)
      .order("position", { ascending: true })
  ) ?? []) as CollectionRow[];
}

export async function createCollection(
  db: Db,
  input: { slug: string; name: string; description?: string | null }
): Promise<{ id: string }> {
  return unwrap(
    "createCollection",
    await db
      .from("product_collections")
      .insert({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
      })
      .select("id")
      .single()
  ) as { id: string };
}

export async function updateCollection(
  db: Db,
  id: string,
  patch: { name?: string; slug?: string; description?: string | null; position?: number }
): Promise<void> {
  const update: Database["public"]["Tables"]["product_collections"]["Update"] = {};

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.slug !== undefined) update.slug = patch.slug;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.position !== undefined) update.position = patch.position;

  unwrap("updateCollection", await db.from("product_collections").update(update).eq("id", id));
}

export async function deleteCollection(db: Db, id: string): Promise<void> {
  unwrap("deleteCollection", await db.from("product_collections").delete().eq("id", id));
}

export async function collectionIdsForProduct(db: Db, productId: string): Promise<string[]> {
  const rows = (unwrap(
    "collectionIdsForProduct",
    await db.from("product_collection_items").select("collection_id").eq("product_id", productId)
  ) ?? []) as { collection_id: string }[];

  return rows.map((row) => row.collection_id);
}

/**
 * Set a product's collections to exactly `collectionIds`.
 *
 * Insert-then-prune, the same ordering as the media usage reconciliation and
 * `setArticleTags`. The stakes are lower here — a stale membership is a wrong
 * listing, not an asset nobody can delete — but two reconciliation routines
 * that behave differently under partial failure is how a codebase grows a
 * subtle class of bug.
 */
export async function setProductCollections(
  db: Db,
  productId: string,
  collectionIds: string[]
): Promise<void> {
  const wanted = [...new Set(collectionIds)];

  if (wanted.length > 0) {
    unwrap(
      "setProductCollections/upsert",
      await db.from("product_collection_items").upsert(
        wanted.map((collectionId) => ({ collection_id: collectionId, product_id: productId })),
        { onConflict: "collection_id,product_id", ignoreDuplicates: true }
      )
    );
  }

  const existing = await collectionIdsForProduct(db, productId);
  const stale = existing.filter((collectionId) => !wanted.includes(collectionId));

  if (stale.length > 0) {
    unwrap(
      "setProductCollections/prune",
      await db
        .from("product_collection_items")
        .delete()
        .eq("product_id", productId)
        .in("collection_id", stale)
    );
  }
}
