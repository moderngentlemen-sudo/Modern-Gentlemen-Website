/**
 * Variants on the public side — pure, no data access.
 *
 * `product_variants` has had an admin UI, a repository and RLS policies since
 * Phase 6a and **no public surface at all**: a merchant could enter three sizes
 * at two prices and a shopper saw neither. This module is the vocabulary that
 * closes it, and it is deliberately narrower than `ProductVariantRow` in
 * `lib/db/repositories/products.ts`.
 *
 * **What is left out is the point.** `stock` is an inventory count and does not
 * belong on a public page — a shopper needs to know *whether* they can buy, not
 * how many are left, and publishing the number tells a competitor the size of
 * the business. So sellability is derived from `availability` here and `stock`
 * never crosses the boundary. `options` is left out for a duller reason: the
 * admin never collects it (the variant form takes a title, a SKU, a price and
 * stock), so it is empty on every row a human made, and rendering an option
 * matrix from a column nothing writes would be inventing a feature.
 *
 * **Money is integer pence and stays that way through this file.** A variant's
 * `price_pence` is nullable and that null is meaningful — it means "whatever the
 * product costs" — which is why the price of a *selection* is a function of two
 * values rather than a column read.
 */

import { PRODUCT_AVAILABILITIES, type ProductAvailability } from "./products";
import type { Pence } from "./money";

/**
 * One buyable variation, in the fields a public page may see.
 *
 * `pricePence: null` is not "free" and not "unknown" — it is "the product's
 * own price", the same meaning the column carries. Resolving it here rather
 * than at the read is what stops a later product price change leaving stale
 * copies behind on every size.
 */
export interface PublicVariant {
  id: string;
  title: string;
  sku: string | null;
  pricePence: Pence | null;
  availability: ProductAvailability;
}

/**
 * The availabilities a shopper can act on.
 *
 * 'preorder' is sellable — that is the whole point of a preorder — while
 * 'discontinued' and 'out_of_stock' are not. Declared as a set derived from the
 * full vocabulary rather than as a free list so that adding a fifth
 * availability to `PRODUCT_AVAILABILITIES` forces a decision here instead of
 * silently defaulting to unsellable.
 */
const SELLABLE: ReadonlySet<ProductAvailability> = new Set<ProductAvailability>(
  PRODUCT_AVAILABILITIES.filter((a) => a === "in_stock" || a === "preorder")
);

export function isVariantSellable(variant: PublicVariant): boolean {
  return SELLABLE.has(variant.availability);
}

/**
 * What a selection actually costs.
 *
 * Both arguments are pence and the result is pence: no pounds appear anywhere
 * in this file, so there is no boundary here for a rounding error to enter
 * through. A missing variant (no variants at all, or a stale selection) prices
 * as the product, which is the behaviour every PDP had before this existed.
 */
export function variantPricePence(
  productPricePence: Pence,
  variant: PublicVariant | null | undefined
): Pence {
  return variant?.pricePence ?? productPricePence;
}

/**
 * Which variant a page should arrive already showing.
 *
 * The first *sellable* one, so a product whose small is sold out opens on the
 * medium rather than on a disabled button and a greyed-out price. When nothing
 * is sellable the first is still returned: the page must show a price, and the
 * add-to-bag control is what refuses, visibly, rather than the page rendering
 * blank. `null` only for a product with no variants at all.
 */
export function defaultVariant(variants: readonly PublicVariant[]): PublicVariant | null {
  if (variants.length === 0) return null;
  return variants.find(isVariantSellable) ?? variants[0];
}

/**
 * What a card should quote for a product sold in several sizes.
 *
 * ⚠️ **The range spans the SELLABLE variants where any are sellable**, which is
 * the same rule `productJsonLd`'s `AggregateOffer` uses and deliberately so: a
 * card and the structured data behind it disagreeing about the lowest price is
 * exactly the mismatch a shopping feed is penalised for. A discontinued small at
 * £99 beside an in-stock large at £159 must not advertise £99 — that is money
 * nobody can spend. When nothing is sellable the range falls back to every
 * variant, because a sold-out product still has a price.
 *
 * Returns `from: false` when every buyable variant costs the same, so a product
 * whose three sizes are one price reads "£145" rather than a "From £145" that
 * implies a choice the shopper does not have.
 */
export function cardPricePence(
  productPricePence: Pence,
  variants: readonly PublicVariant[] | undefined
): { pence: Pence; from: boolean } {
  if (!variants || variants.length === 0) return { pence: productPricePence, from: false };

  const sellable = variants.filter(isVariantSellable);
  const priced = (sellable.length > 0 ? sellable : variants).map((variant) =>
    variantPricePence(productPricePence, variant)
  );

  const low = Math.min(...priced);
  return { pence: low, from: Math.max(...priced) !== low };
}

/** Whether a product is sold as variations at all. */
export function hasVariants(product: { variants?: readonly PublicVariant[] }): boolean {
  return (product.variants?.length ?? 0) > 0;
}

/**
 * Find a variant by id, tolerating a stale one.
 *
 * A bag persists in `localStorage` across a merchant deleting a size, so "the
 * variant this line names is gone" is an ordinary state rather than an error.
 * Callers fall back to the product's own price, which is what the line showed
 * before variants existed.
 */
export function findVariant(
  variants: readonly PublicVariant[] | undefined,
  variantId: string | null | undefined
): PublicVariant | null {
  if (!variantId || !variants) return null;
  return variants.find((v) => v.id === variantId) ?? null;
}

// ---------------------------------------------------------------------------
// Cart line identity
// ---------------------------------------------------------------------------

/**
 * The separator between a slug and a variant id in a cart line's key.
 *
 * `::` cannot occur in either half by construction: a product slug matches
 * `^[a-z0-9]+(?:-[a-z0-9]+)*$` (`productMetaSchema`) and a variant id is a uuid.
 * So the key round-trips, and `parseCartLineKey` is a real inverse rather than a
 * best guess.
 */
const KEY_SEPARATOR = "::";

/**
 * A cart line's identity — the slug alone when no variant is selected.
 *
 * **That degenerate case is load-bearing.** Two sizes of one product are two
 * lines, so the cart cannot go on being keyed by slug; but every bag already in
 * a shopper's `localStorage` holds `{ slug, qty }` with no variant, and every
 * call site that says `cart.remove(l.slug)` was written against that. Making the
 * key *equal* the slug when there is no variant means the stored shape stays
 * valid, the old call sites keep working, and only the lines that genuinely need
 * a second dimension get one.
 */
export function cartLineKey(slug: string, variantId?: string | null): string {
  return variantId ? `${slug}${KEY_SEPARATOR}${variantId}` : slug;
}

export function parseCartLineKey(key: string): { slug: string; variantId: string | null } {
  const at = key.indexOf(KEY_SEPARATOR);
  if (at === -1) return { slug: key, variantId: null };
  return { slug: key.slice(0, at), variantId: key.slice(at + KEY_SEPARATOR.length) };
}
