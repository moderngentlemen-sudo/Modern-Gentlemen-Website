import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { getPublishedProductSeo } from "@/lib/services/publicCatalog";
import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, metaDescription, pageTitle, productJsonLd } from "@/lib/domain/seo";
import { publicPathForProduct } from "@/lib/domain/routes";

/**
 * The PDP's `<head>`, and its Product structured data.
 *
 * **A layout, not the page.** `page.tsx` here is `"use client"` — it holds the
 * gallery's selected image, the quantity stepper and the add-to-bag state, and
 * it reads the catalogue from React context. A client component cannot export
 * `metadata` or `generateMetadata`; Next only reads those from server modules.
 * The choices were to split the page into a server shell wrapping a client body,
 * or to put the head in the segment's layout. The layout wins for one reason
 * that outranks taste: **the page is pixel-verified**, and a layout adds
 * metadata and a `<script>` without touching a line of it. Zero risk to the
 * baselines, because a script tag has no box.
 *
 * The cost is one extra read per product page at build time — `generateMetadata`
 * and the JSON-LD below share a single call, but the client page separately
 * resolves the same product out of `CatalogProvider`. That context is already
 * loaded by the site layout for the bag drawer, so it is not an extra query;
 * the read here is the only one this segment adds, and it fetches one row.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductSeo(slug);

  // The page renders its own in-page "we couldn't find that product" rather than
  // calling `notFound()`, so this is a real rendered page and needs a title.
  // `noindex` on it: a soft 404 that search engines index is worse than a hard
  // one, because it accumulates.
  if (!product) {
    return { title: pageTitle("Product not found"), robots: { index: false, follow: true } };
  }

  const url = canonicalUrl(canonicalSiteUrl(), publicPathForProduct(product.slug));
  const description = metaDescription(product.blurb);

  return {
    title: pageTitle(product.name),
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: pageTitle(product.name),
      description,
      url,
      ...(product.images.length > 0
        ? { images: [canonicalUrl(canonicalSiteUrl(), product.images[0])] }
        : {}),
    },
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublishedProductSeo(slug);

  return (
    <>
      {product && <JsonLd data={productJsonLd(canonicalSiteUrl(), product)} />}
      {children}
    </>
  );
}
