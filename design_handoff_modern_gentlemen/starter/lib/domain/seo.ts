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

export const BRAND = "Modern Gentlemen";

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
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "GBP",
      // toFixed(2), because 14500 pence is 145 and a crawler expects "145.00".
      price: penceToPounds(product.pricePence).toFixed(2),
      availability: schemaAvailability(product.availability),
    },
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
