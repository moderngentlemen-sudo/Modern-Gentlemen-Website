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
import { isProductBadge, productSpecsSchema } from "@/lib/domain/products";
import type { Product, Tag } from "@/lib/cart/types";

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
      "slug, name, cat, cat_label, blurb, story, material, price_pence, badges, specs, product_media(position, media_assets(bucket, storage_path, external_url))"
    )
    .eq("status", "published")
    .order("position", { ascending: true });

  // Thrown, not swallowed, and for the reason `publicContent.ts` sets out at
  // length: during a static build this fails the build, which is the correct
  // outcome, and during revalidation Next keeps serving the last good output.
  if (error) {
    throw new Error(`Could not read the published products: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
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
  }));
}
