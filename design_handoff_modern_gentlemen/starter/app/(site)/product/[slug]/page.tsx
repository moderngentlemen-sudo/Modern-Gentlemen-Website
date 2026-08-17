import { notFound } from "next/navigation";

import { getPublishedProductSeo, listPublishedProducts } from "@/lib/services/publicCatalog";

import { ProductView } from "./ProductView";

/**
 * The PDP's server shell — two fixes that had to arrive together.
 *
 * **An unknown slug used to return 200.** The whole page was `"use client"`, so
 * it could not call `notFound()`; it rendered an in-page "we couldn't find that
 * product" screen instead and served it with a success status. That is a soft
 * 404, the shape search engines index and then keep — `layout.tsx` already
 * marked it `noindex` in acknowledgement. A thin server component in front of
 * the client body can do what the client body could not, and the site's designed
 * 404 (`app/not-found.tsx`, chrome and all) is what renders now.
 *
 * **And it was the only public route still server-rendered on demand.**
 * `generateStaticParams` prerenders the catalogue, so the PDP joins categories
 * and articles at `●` with the layout's hourly revalidate rather than costing a
 * render per visit.
 *
 * ⚠️ **`dynamicParams` is left at its default of `true` on purpose.** A product
 * published after the last build is not in the list below, and with it `false`
 * that product would 404 until someone redeployed — a publish that silently does
 * not work. Left true, an unlisted slug is rendered on demand, which is exactly
 * what this route did for every product until now.
 *
 * The existence check costs one read, and `layout.tsx` makes the same one for
 * the metadata and the JSON-LD. Two rows per render of a page that prerenders
 * hourly is not worth a `cache()` and the request-scope assumptions it carries.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const products = await listPublishedProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // The lightest read that answers the question: `getPublishedProductSeo`
  // fetches one row and is scoped to `status = 'published'` by the same policy
  // the rest of the public catalogue reads under, so a draft product is a 404
  // here rather than a page nobody meant to publish.
  const product = await getPublishedProductSeo(slug);
  if (!product) notFound();

  return <ProductView slug={slug} />;
}
