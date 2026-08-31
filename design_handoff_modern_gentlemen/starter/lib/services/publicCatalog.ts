/**
 * Public catalogue reads — the published store's data layer.
 *
 * The sibling of `publicContent.ts`, and it takes the same stance for the same
 * reason: **no `requirePermission` call, deliberately.** `createPublicClient()`
 * is anonymous, and `0005_commerce.sql`'s policy is
 * `using (status = 'published' or is_staff())`. An anonymous caller is not
 * staff, so a draft product cannot come back through here even if a query asked
 * for one. The database is the enforcement; this file is the shape.
 *
 * It returns the **existing** `Product` from `lib/cart/types.ts` rather than a
 * new public type. That is what makes the switch off `lib/catalog.ts` a change
 * of source and nothing else: every card, gallery, spec table and cart line
 * keeps the contract it was pixel-verified against, and the diff cannot quietly
 * become a redesign.
 */

import { createPublicClient } from "@/lib/db/public";
import { supabaseUrl } from "@/lib/db/env";
import { resolveAssetUrl } from "@/lib/domain/media";
import { penceToPounds } from "@/lib/domain/money";
import {
  isProductAvailability,
  isProductBadge,
  productSpecsSchema,
  type ProductAvailability,
} from "@/lib/domain/products";
import type { PublicVariant } from "@/lib/domain/variants";
import type { Product, Tag } from "@/lib/cart/types";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";

/**
 * The gallery arrives as an embedded array. PostgREST can order an embedded
 * resource, but the syntax is easy to get subtly wrong and fails soft — a
 * mis-specified order silently returns the rows in whatever order the planner
 * chose, which here would shuffle which photograph is the hero. Sorting in
 * TypeScript is one line and cannot fail that way.
 */
interface MediaRow {
  position: number;
  media_assets: {
    bucket: string;
    storage_path: string;
    external_url: string | null;
  } | null;
}

function galleryUrls(rows: MediaRow[] | null): string[] {
  if (!rows) return [];

  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((row) =>
      row.media_assets
        ? [
            resolveAssetUrl(supabaseUrl(), {
              bucket: row.media_assets.bucket,
              storagePath: row.media_assets.storage_path,
              externalUrl: row.media_assets.external_url,
            }),
          ]
        : []
    );
}

/**
 * The variant rows, mapped to the public shape and ordered by `position`.
 *
 * Sorted in TypeScript for the same reason the gallery is: PostgREST's embedded
 * ordering fails soft, and here a wrong order would put the sizes on the picker
 * in whatever sequence the planner chose.
 *
 * ⚠️ **`stock` is deliberately not selected.** Not mapped-and-dropped —
 * *not selected*, so the column never reaches the browser at all. `lib/domain/
 * variants.ts` sets out why an inventory count is not public data; leaving it
 * out of the query is what makes that a property of the wire rather than of the
 * component that happens to render today.
 */
interface VariantRow {
  id: string;
  title: string;
  sku: string | null;
  price_pence: number | null;
  availability: string;
  position: number;
}

function variantsOf(rows: VariantRow[] | null): PublicVariant[] {
  if (!rows) return [];

  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      title: row.title,
      sku: row.sku,
      pricePence: row.price_pence,
      // Same narrowing, and the same default, as the product's own column: a
      // row holding something outside the vocabulary is treated as unsellable
      // rather than crashing the PDP.
      availability: isProductAvailability(row.availability) ? row.availability : "out_of_stock",
    }));
}

/**
 * `badges` is an array in the database and `tag` is one value on the card,
 * because the card has room for exactly one. The first badge wins; anything the
 * store has no styling for is dropped to `""`, which is what the demo catalog
 * uses for "no badge" and what the components already test for falsiness.
 */
function tagOf(badges: string[] | null): Tag {
  const first = badges?.[0];
  return first && isProductBadge(first) ? first : "";
}
export async function listPublishedProducts(): Promise<Product[]> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("products")
    // One string literal, not a concatenation: supabase-js infers the row type
    // by parsing this at the type level, and `string` carries nothing to parse.
    // Split it and every field below degrades to `GenericStringError`.
    .select(
      "slug, name, cat, cat_label, blurb, story, material, price_pence, badges, specs, product_media(position, media_assets(bucket, storage_path, external_url)), product_variants(id, title, sku, price_pence, availability, position)"
    )
    .eq("status", "published")
    .order("position", { ascending: true });

  // Thrown, not swallowed, and for the reason `publicContent.ts` sets out at
  // length: during a static build this fails the build, which is the correct
  // outcome, and during revalidation Next keeps serving the last good output.
  if (error) {
    throw new Error(`Could not read the published products: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const variants = variantsOf(row.product_variants as VariantRow[] | null);

    return {
      slug: row.slug,
      cat: row.cat ?? "",
      catLabel: row.cat_label ?? "",
      name: row.name,
      // Integer pence is the canonical unit; pounds exist only at this boundary,
      // where the pixel-verified components expect them. lib/domain/money is the
      // only place that converts.
      price: penceToPounds(row.price_pence),
      tag: tagOf(row.badges),
      material: row.material ?? "",
      blurb: row.blurb ?? "",
      story: row.story ?? "",
      specs: productSpecsSchema.parse(row.specs ?? []),
      images: galleryUrls(row.product_media as MediaRow[] | null),
      // Omitted rather than empty when a product is sold as one thing. The demo
      // catalogue this read is asserted against field-by-field in
      // `tests/integration/publicCatalog.test.ts` carries no variants, and an
      // always-present `variants: []` would make that deep equality fail on a
      // difference that is not one.
      ...(variants.length > 0 ? { variants } : {}),
    };
  });
}

/**
 * One published product, in the fields structured data needs — and no others.
 *
 * A deliberately separate read rather than a `find` over `listPublishedProducts`,
 * for two reasons. It fetches one row instead of the whole catalogue to render
 * one page's `<head>`; and it carries `price_pence` and `availability`, neither
 * of which the `Product` above has. `Product` is the pixel-verified store
 * contract — `price` on it is pounds, and it has no availability at all — so
 * widening it to feed a meta tag would be the tail wagging the dog.
 *
 * Pence stays pence all the way to `productJsonLd`, which is the only place it
 * becomes a decimal. The store's own pounds conversion happens above and never
 * meets this path, so a price cannot make a double round-trip.
 */
export interface PublishedProductSeo {
  slug: string;
  name: string;
  blurb: string | null;
  material: string | null;
  pricePence: number;
  availability: ProductAvailability;
  images: string[];
  /**
   * Always present, empty for a product sold as one thing — unlike `Product`
   * above, which omits the key entirely. The difference is deliberate and it is
   * about what each shape is compared against: `Product` is deep-equalled
   * against the demo catalogue, where an always-present `variants: []` would
   * fail on a difference that is not one. Nothing deep-equals this, so the
   * simpler invariant wins.
   */
  variants: PublicVariant[];
}

export async function getPublishedProductSeo(slug: string): Promise<PublishedProductSeo | null> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("products")
    .select(
      "slug, name, blurb, material, price_pence, availability, product_media(position, media_assets(bucket, storage_path, external_url)), product_variants(id, title, sku, price_pence, availability, position)"
    )
    .eq("status", "published")
    .eq("slug", slug)
    // `maybeSingle`, not `single`: an unknown slug is an ordinary 404 here, and
    // `single` would turn it into a thrown PostgREST error the route would have
    // to unpick from a message string.
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the product "${slug}": ${error.message}`);
  }

  if (!data) return null;

  return {
    slug: data.slug,
    name: data.name,
    blurb: data.blurb,
    material: data.material,
    pricePence: data.price_pence,
    // The column is `text` with a CHECK, so the generated type is `string`. A
    // row that somehow holds something else is treated as unsellable rather
    // than crashing a page render — `in_stock` is the wrong default to guess.
    availability: isProductAvailability(data.availability) ? data.availability : "out_of_stock",
    images: galleryUrls(data.product_media as MediaRow[] | null),
    // The same mapper the store's own read uses, so the prices structured data
    // advertises and the prices the picker shows come from one place. They
    // disagreed before this: the PDP priced every size and the JSON-LD
    // advertised the product's own price as a lone Offer, so a product whose
    // large costs £159.99 told a crawler £145.
    variants: variantsOf(data.product_variants as VariantRow[] | null),
  };
}

function productSections(payload: Json | null): BlockTree {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const sections = (payload as Record<string, unknown>).sections;
  return Array.isArray(sections) ? (sections as BlockTree) : [];
}

/** Product identity and builder tree without widening the established store contract. */
export async function getPublishedProductBuilder(
  slug: string
): Promise<{ id: string; sections: BlockTree } | null> {
  const db = createPublicClient();
  const { data, error } = await db
    .from("products")
    .select("id, published_data")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Could not read the product builder content: ${error.message}`);
  return data ? { id: data.id, sections: productSections(data.published_data) } : null;
}
