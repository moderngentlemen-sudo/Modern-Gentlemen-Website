import type { Metadata } from "next";

import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, pageTitle } from "@/lib/domain/seo";

const DESCRIPTION =
  "The Modern Gentlemen store — considered objects for style, grooming, watches and the road. Free UK shipping over £50.";

/**
 * A layout because `shop/page.tsx` is `"use client"` (it drives the category
 * filter off `useSearchParams`), and a client module cannot export `metadata`.
 *
 * **The canonical is `/shop`, unconditionally** — deliberately, and this is the
 * one decision on this page worth defending. The filter writes `?cat=Grooming`
 * into the URL, so the store has as many addresses as it has categories, all
 * serving the same page with a subset of the same products. Left alone, a
 * crawler treats each as a separate page and splits the store's ranking across
 * six near-duplicates. Pointing every one of them at `/shop` says "these are
 * views of one page", which is what they are. `metadata` is static here rather
 * than `generateMetadata` precisely because it must not vary with the query.
 */
export const metadata: Metadata = {
  title: pageTitle("The Store"),
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl(canonicalSiteUrl(), "/shop") },
  openGraph: {
    type: "website",
    title: pageTitle("The Store"),
    description: DESCRIPTION,
    url: canonicalUrl(canonicalSiteUrl(), "/shop"),
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
