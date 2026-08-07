"use client";

/**
 * The published catalogue, hydrated once per route and read through context.
 *
 * Why a provider rather than each page fetching for itself: the bag drawer
 * lives in the header, so *every* route needs to turn a stored slug into a
 * product. `CartProvider` has always done that with a synchronous
 * `getProduct(slug)`, and keeping that contract is what lets the store move off
 * the demo module without touching a single pixel-verified component. The data
 * now comes from Supabase (`lib/services/publicCatalog.ts`), fetched in the
 * server layout and handed down as props.
 *
 * The helpers below are lifted verbatim from the old `lib/catalog.ts` — they
 * were already pure functions over the array. `related`'s same-category-first
 * ordering in particular is behaviour the PDP's "You might also like" row is
 * baselined against, so it is copied rather than rewritten.
 */

import React, { createContext, useContext, useMemo } from "react";
import type { Product } from "@/lib/cart/types";

/**
 * The filter chips on /shop, in order. A fixed editorial vocabulary rather than
 * something derived from the rows: the chip row's contents and order are part
 * of the design, and deriving them would let a newly-categorised product
 * silently rearrange the page.
 */
export const groups = ["All", "Style", "Watches", "Grooming", "Accessories"] as const;

export interface Catalog {
  allProducts: () => Product[];
  getProduct: (slug: string) => Product | null;
  byGroup: (group: string) => Product[];
  related: (slug: string, n?: number) => Product[];
}

export function makeCatalog(products: Product[]): Catalog {
  const bySlug: Record<string, Product> = Object.fromEntries(products.map((p) => [p.slug, p]));

  return {
    allProducts: () => products.slice(),
    getProduct: (slug) => bySlug[slug] || null,
    byGroup: (group) =>
      group === "All" ? products.slice() : products.filter((p) => p.cat === group),
    related: (slug, n = 4) => {
      const p = bySlug[slug];
      if (!p) return products.slice(0, n);
      const same = products.filter((x) => x.cat === p.cat && x.slug !== slug);
      const rest = products.filter((x) => x.cat !== p.cat);
      return same.concat(rest).slice(0, n);
    },
  };
}

const CatalogContext = createContext<Catalog | null>(null);

export function CatalogProvider({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  // Keyed on the array identity: the layout re-renders with a new array only
  // when a revalidation brought new rows, and rebuilding the slug index on
  // every unrelated render would be waste.
  const catalog = useMemo(() => makeCatalog(products), [products]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within <CatalogProvider>");
  return ctx;
}
