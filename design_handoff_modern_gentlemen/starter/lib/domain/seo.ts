/**
 * Search-engine metadata and structured data. Pure — builds objects, writes
 * nothing, renders nothing.
 *
 * Track A's Phase 7 has carried "SEO: per-route metadata, Product JSON-LD on
 * PDPs, sitemap + robots" as unstarted since the front end was built. The site
 * is live and public now, so until this lands there is a finished storefront
 * that search engines cannot index properly: one title for every page, no
 * canonical URLs, no sitemap, and prices no crawler can read.
 *
 * Everything here returns plain data. What renders it is the route — a
 * `Metadata` export or a `<script type="application/ld+json">` — so the rules
 * about what a title *says* stay testable without a DOM.
 */

import { penceToPounds } from "./money";
import type { ProductAvailability } from "./products";
import { publicPathForArticle, publicPathForProduct } from "./routes";
import { isVariantSellable, variantPricePence, type PublicVariant } from "./variants";

export const BRAND = "Modern Gentlemen";

/** Every price in this catalogue is sterling. The column carries a currency and
 *  the day it varies this should read it rather than assume. */
const CURRENCY = "GBP";

/** The suffix every page title carries, matching the one `/article/[slug]` has
 *  used since Track A. An em dash, not a hyphen — it is the brand's own. */
const TITLE_SUFFIX = ` — ${BRAND}`;

/**
 * A page title, brand-suffixed exactly once.
 *
 * Idempotent on purpose: a title that already ends in the brand is left alone,
 * so composing a title from content that happens to mention it cannot produce
 * "Modern Gentlemen — Modern Gentlemen". An empty or missing title falls back
 * to the brand alone rather than a lonely dash.
 */
export function pageTitle(title?: string | null): string {
  const trimmed = title?.trim();
  if (!trimmed) return BRAND;
  if (trimmed === BRAND || trimmed.endsWith(TITLE_SUFFIX)) return trimmed;
  return `${trimmed}${TITLE_SUFFIX}`;
}

/**
 * A meta description: single-spaced, trimmed, and cut at a word boundary.
 *
 * 160 characters is where Google has historically truncated, and a description
 * cut mid-word reads as broken rather than as abbreviated. Text shorter than the
 * limit is returned untouched — no ellipsis on something that was never cut.
 */
export function metaDescription(text: string | null | undefined, max = 160): string | undefined {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * An absolute URL for a public path.
 *
 * Canonical tags and structured data both require absolute URLs — a relative
 * one is silently ignored by some crawlers and misread by others. The site URL's
 * trailing slash is normalised away so `canonicalUrl(base, "/")` is the origin
 * rather than a double slash, which would be a *different* URL to a crawler and
 * split the ranking of the homepage.
 */
export function canonicalUrl(siteUrl: string, path: string): string {
  const origin = siteUrl.replace(/\/+$/, "");
  const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

/**
 * `products.availability` as schema.org spells it.
 *
 * A one-to-one map over the four values `0005_commerce.sql`'s CHECK allows,
 * rather than a boolean "in stock or not". The column already distinguishes a
 * preorder from a sold-out item and a discontinued one from both, and
 * collapsing that to `OutOfStock` would state something false to a shopping
 * feed: `OutOfStock` means "come back later", `Discontinued` means "do not",
 * and `PreOrder` means "buy it now, it ships later". Merchant Center reads
 * these and acts on them.
 */
export function schemaAvailability(availability: ProductAvailability): string {
  switch (availability) {
    case "in_stock":
      return "https://schema.org/InStock";
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    case "preorder":
      return "https://schema.org/PreOrder";
    case "discontinued":
      return "https://schema.org/Discontinued";
  }
}

export interface ProductForSchema {
  name: string;
  slug: string;
  blurb?: string | null;
  material?: string | null;
  pricePence: number;
  availability: ProductAvailability;
  images: string[];
  /**
   * Absent or empty means "sold as one thing" — the shape every product had
   * before variants had a public surface, and the shape the whole seeded
   * catalogue still has. Optional rather than required so that stays the
   * default rather than something each caller must remember to say.
   */
  variants?: readonly PublicVariant[];
}

/** A price in pence as schema.org wants it: a bare decimal, no currency symbol. */
function schemaPrice(pence: number): string {
  // toFixed(2), because 14500 pence is 145 and a crawler expects "145.00".
  return penceToPounds(pence).toFixed(2);
}

/**
 * One variant's `Offer`.
 *
 * `url` is the PDP's, not a per-variant one, because there is no per-variant
 * URL to give: the picker is client state, the page does not read a `?variant=`
 * and inventing one here would advertise a link that resolves to the default
 * size. `name` carries the variant's title so a rich result can tell the offers
 * apart, and `sku` is emitted only when the merchant actually entered one —
 * `"sku": null` is worse than no `sku` at all.
 */
function variantOffer(url: string, productPricePence: number, variant: PublicVariant) {
  return {
    "@type": "Offer",
    url,
    name: variant.title,
    ...(variant.sku ? { sku: variant.sku } : {}),
    priceCurrency: CURRENCY,
    price: schemaPrice(variantPricePence(productPricePence, variant)),
    availability: schemaAvailability(variant.availability),
  };
}

/**
 * The offer block: one `Offer` for a product sold as one thing, an
 * `AggregateOffer` for one sold as variations.
 *
 * ⚠️ **The single-offer branch is byte-identical to what shipped before
 * variants existed**, and that is deliberate rather than incidental: no seeded
 * product carries a variant row, so the whole catalogue's structured data is
 * unchanged by this and the sixteen visual baselines cannot move.
 *
 * **The range is computed over the *sellable* variants where any are sellable.**
 * A discontinued small at £99 beside an in-stock large at £159 would otherwise
 * advertise `lowPrice: 99.00` for money nobody can spend, which is the precise
 * shape of mismatch that gets a product feed penalised. When nothing is
 * sellable the range falls back to every variant — an out-of-stock product
 * still has a price, and omitting `lowPrice` would make the block invalid
 * rather than honest.
 *
 * **Variant availability governs, and the product's own column is not consulted
 * here.** That matches the PDP exactly: once a product has variants, the page's
 * add-to-bag button reads the selected variant's availability and nothing else.
 * Structured data that disagreed with the button would be the worse bug.
 */
function offersFor(
  url: string,
  product: ProductForSchema,
  variants: readonly PublicVariant[]
): Record<string, unknown> {
  if (variants.length === 0) {
    return {
      "@type": "Offer",
      url,
      priceCurrency: CURRENCY,
      price: schemaPrice(product.pricePence),
      availability: schemaAvailability(product.availability),
    };
  }

  const sellable = variants.filter(isVariantSellable);
  const priced = (sellable.length > 0 ? sellable : variants).map((variant) =>
    variantPricePence(product.pricePence, variant)
  );

  return {
    "@type": "AggregateOffer",
    url,
    priceCurrency: CURRENCY,
    lowPrice: schemaPrice(Math.min(...priced)),
    highPrice: schemaPrice(Math.max(...priced)),
    offerCount: variants.length,
    offers: variants.map((variant) => variantOffer(url, product.pricePence, variant)),
  };
}

/**
 * Product structured data for a PDP.
 *
 * **Price is emitted from integer pence through `penceToPounds`**, never
 * formatted for display first: `formatPence` produces "£145.00", and schema.org
 * wants a bare number with the currency in its own field. Putting a currency
 * symbol in `price` is the single most common way a product feed is rejected.
 *
 * `priceCurrency` is GBP because every price in this catalogue is; the column
 * carries a currency and the day it varies this should read it rather than
 * assume.
 */
export function productJsonLd(siteUrl: string, product: ProductForSchema): Record<string, unknown> {
  const url = canonicalUrl(siteUrl, publicPathForProduct(product.slug));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: metaDescription(product.blurb) ?? undefined,
    ...(product.material ? { material: product.material } : {}),
    image: product.images.map((image) => canonicalUrl(siteUrl, image)),
    brand: { "@type": "Brand", name: BRAND },
    offers: offersFor(url, product, product.variants ?? []),
  };
}

export interface ArticleForSchema {
  title: string;
  slug: string;
  dek?: string | null;
  author?: string | null;
  image?: string | null;
  publishedAt?: string | null;
}

/** Article structured data. `Article` rather than `NewsArticle`: this is an
 *  editorial magazine, and `NewsArticle` carries expectations about timeliness
 *  and corrections policy the site does not meet. */
export function articleJsonLd(siteUrl: string, article: ArticleForSchema): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: metaDescription(article.dek) ?? undefined,
    url: canonicalUrl(siteUrl, publicPathForArticle(article.slug)),
    ...(article.image ? { image: [canonicalUrl(siteUrl, article.image)] } : {}),
    ...(article.author ? { author: { "@type": "Person", name: article.author } } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    publisher: { "@type": "Organization", name: BRAND },
  };
}

/** Site-level identity, emitted once on the homepage. */
export function organizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: canonicalUrl(siteUrl, "/"),
    description: "Style, grooming, watches, culture and film — for the considered man.",
  };
}
