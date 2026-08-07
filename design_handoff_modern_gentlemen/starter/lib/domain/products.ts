/**
 * Product vocabulary and shape rules — pure, no data access.
 *
 * `0005_commerce.sql` put three of a product's fields in `jsonb` rather than in
 * columns: `specs`, `badges` and `affiliate`. That was the right call — six
 * mostly-null affiliate columns would be worse — but it means Postgres checks
 * almost nothing about their contents. The only constraint it does carry is
 * `affiliate_needs_merchant_url`, which fires on a missing key and says nothing
 * about the value. This file is where the rest of the shape is enforced, on the
 * way in.
 *
 * The vocabularies are declared here rather than derived from `lib/catalog.ts`,
 * which is demo content and does not belong in `lib/domain`. `products.test.ts`
 * asserts the two agree — the same conformance stance `lib/domain/articles.ts`
 * takes towards the template library, and `lib/blocks` towards the section
 * registry. Co-location would look safer while checking nothing.
 *
 * Money never appears here as pounds. `price_pence` and `compare_at_pence` are
 * integer pence and stay that way; `lib/domain/money.ts` is the only converter.
 */

import { z } from "zod";

/**
 * `products.fulfilment` — the CHECK in `0005_commerce.sql`.
 *
 * 'direct' is something the store sells and ships. 'affiliate' is something it
 * writes about and links to, where the money is somebody else's. The difference
 * is not cosmetic: an affiliate product has no stock to track and must carry a
 * merchant URL, which the database itself insists on.
 */
export const PRODUCT_FULFILMENTS = ["direct", "affiliate"] as const;
export type ProductFulfilment = (typeof PRODUCT_FULFILMENTS)[number];

/** `products.availability` — same migration. */
export const PRODUCT_AVAILABILITIES = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "discontinued",
] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

/** `product_media.role` — which slot an attached asset fills. */
export const PRODUCT_MEDIA_ROLES = ["primary", "gallery", "swatch"] as const;
export type ProductMediaRole = (typeof PRODUCT_MEDIA_ROLES)[number];

/**
 * The badge vocabulary, matching `Tag` in `lib/cart/types.ts`.
 *
 * The column is `text[]` and the demo model is one optional string, so the
 * store's own card can only ever show the first. Kept as a list because the
 * column is one, and because "NEW" and "LIMITED" are not mutually exclusive.
 * The empty string the demo type allows is deliberately *not* a badge here —
 * an absent badge is an empty array, not an array holding nothing.
 */
export const PRODUCT_BADGES = ["NEW", "BESTSELLER", "LIMITED"] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number];

export function isProductFulfilment(value: string): value is ProductFulfilment {
  return (PRODUCT_FULFILMENTS as readonly string[]).includes(value);
}

export function isProductAvailability(value: string): value is ProductAvailability {
  return (PRODUCT_AVAILABILITIES as readonly string[]).includes(value);
}

/**
 * `badges` is a free `text[]` in the database — the check constraint is on
 * `status`, not on this — so a row can hold a badge the store has no styling
 * for. The card renders one badge and `lib/cart/types.ts` spells the same
 * vocabulary as `Tag`, adding `""` for "no badge"; this is the narrowing that
 * gets from one to the other without a cast.
 */
export function isProductBadge(value: string): value is ProductBadge {
  return (PRODUCT_BADGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// The jsonb payloads
// ---------------------------------------------------------------------------

/**
 * `products.specs` — the ordered key/value rows the PDP renders as its spec
 * table. A tuple rather than `{ label, value }` because that is the shape
 * `lib/catalog.ts` already holds and `BodySpec` already renders; changing it
 * would be a change to the pixel-verified store for no gain.
 */
export const productSpecSchema = z.tuple([z.string().min(1), z.string()]);
export const productSpecsSchema = z.array(productSpecSchema);
export type ProductSpec = z.infer<typeof productSpecSchema>;

/**
 * `products.affiliate`.
 *
 * `merchant_url` is required by the database whenever `fulfilment` is
 * 'affiliate' (`affiliate_needs_merchant_url`), but the constraint uses `?`,
 * which only asks whether the *key* is present — `{"merchant_url": null}`
 * satisfies it. So the useful check is here, and it is the one an editor
 * actually benefits from: that the value is a URL they could click.
 *
 * `external_price_pence` is what the merchant charges. It is separate from
 * `price_pence` because the store does not set it and cannot honour it — it is
 * a quoted figure that goes stale, not a price.
 */
export const affiliateSchema = z
  .object({
    merchant_name: z.string().min(1).optional(),
    merchant_url: z.string().url().optional(),
    disclosure: z.string().optional(),
    external_price_pence: z.number().int().nonnegative().optional(),
  })
  .strict();

export type Affiliate = z.infer<typeof affiliateSchema>;

/**
 * The whole-product rule the database cannot express usefully.
 *
 * Postgres checks that the *key* exists; this checks that the link works. The
 * issue is reported on `affiliate.merchant_url` so a form can focus the control
 * that is wrong, the same reason `BlockIssue.path` is kept precise in
 * `lib/blocks/validate.ts`.
 */
export const productMetaSchema = z
  .object({
    name: z.string().min(1, "A product needs a name."),
    slug: z
      .string()
      .min(1, "A product needs a slug.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
    fulfilment: z.enum(PRODUCT_FULFILMENTS),
    availability: z.enum(PRODUCT_AVAILABILITIES),
    price_pence: z.number().int().nonnegative("A price cannot be negative."),
    compare_at_pence: z.number().int().nonnegative().nullable(),
    stock: z.number().int().nonnegative("Stock cannot be negative."),
    track_inventory: z.boolean(),
    badges: z.array(z.enum(PRODUCT_BADGES)),
    specs: productSpecsSchema,
    affiliate: affiliateSchema,
  })
  .superRefine((product, ctx) => {
    if (product.fulfilment === "affiliate" && !product.affiliate.merchant_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["affiliate", "merchant_url"],
        message: "An affiliate product needs the merchant URL it links out to.",
      });
    }

    // A strike-through price that is not higher than the real one reads as a
    // price rise. Cheap to catch here; impossible to notice on a live PDP.
    if (product.compare_at_pence !== null && product.compare_at_pence <= product.price_pence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compare_at_pence"],
        message: "The compare-at price must be higher than the price to read as a reduction.",
      });
    }
  });

export type ProductMeta = z.infer<typeof productMetaSchema>;

/**
 * Whether stock is worth showing at all.
 *
 * An affiliate product's stock column is meaningless — the merchant holds the
 * inventory — and `track_inventory` is how a made-to-order direct product opts
 * out. Both cases render the same way, so they are answered in one place rather
 * than as two conditions repeated across the form and the list.
 */
export function tracksStock(product: {
  fulfilment: ProductFulfilment;
  track_inventory: boolean;
}): boolean {
  return product.fulfilment === "direct" && product.track_inventory;
}
