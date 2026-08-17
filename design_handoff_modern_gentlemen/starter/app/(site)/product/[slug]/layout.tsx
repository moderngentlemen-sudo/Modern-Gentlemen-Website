import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { getPublishedProductSeo } from "@/lib/services/publicCatalog";
import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, metaDescription, pageTitle, productJsonLd } from "@/lib/domain/seo";
import { publicPathForProduct } from "@/lib/domain/routes";

/**
 * The PDP's `<head>`, and its Product structured data.
 *
 * **Still a layout, though the reason it was one has gone.** This file exists
 * because `page.tsx` used to be `"use client"` in its entirety, and a client
 * module cannot export `metadata` or `generateMetadata`. The page is now a
 * server shell over `ProductView.tsx`, so the head *could* move into it — and is
 * deliberately left here anyway. Moving it would relocate the `<script>` in the
 * prerendered HTML of a **pixel-verified** page to buy nothing: the reads do not
 * collapse either way, because Next invokes `generateMetadata` and the component
 * separately regardless of which file they live in.
 *
 * The cost is one read per render here plus one in `page.tsx`'s existence check.
 * Both fetch a single row on a route that prerenders and revalidates hourly.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductSeo(slug);

  // `page.tsx` calls `notFound()` for this slug, so what renders is the site's
  // 404 with a real 404 status. The title is still worth setting — Next resolves
  // metadata from this segment either way, and "Product not found" beats
  // inheriting the site default on a page that is about a specific miss.
  // `noindex` stays as belt and braces behind the status code.
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
