"use client";

import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { MediaImage } from "../ui/MediaImage";

/** The Store — commerce row (library #05, #28 The Drop). Pulls from the catalog.
 *  Pass `group` to filter, or explicit `slugs` to curate. */
export function ProductRow({
  heading = "The Store",
  eyebrow,
  group,
  slugs,
  href = "/shop",
}: {
  heading?: string;
  eyebrow?: string;
  group?: string;
  slugs?: string[];
  href?: string;
}) {
  const cart = useCart();
  const { allProducts, byGroup } = useCatalog();
  const products = slugs?.length
    ? slugs.map((s) => allProducts().find((p) => p.slug === s)).filter(Boolean)
    : byGroup(group || "All").slice(0, 4);

  return (
    <section className="container-mg py-16 md:py-24">
      <div className="flex items-end justify-between mb-7">
        <div>
          {eyebrow && <div className="font-serif italic text-mg-fg/50 text-lg">{eyebrow}</div>}
          <h2 className="font-grotesk font-semibold text-3xl md:text-4xl mt-1">{heading}</h2>
        </div>
        <Link href={href} className="font-mono text-[11px] tracking-[0.18em] text-mg-accent">
          STORE ALL →
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map(
          (p) =>
            p && (
              <div key={p.slug} className="group">
                <Link href={`/product/${p.slug}`}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-mg-surface">
                    <MediaImage
                      src={p.images[0]}
                      alt={p.name}
                      slot="quarter"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </Link>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <Link href={`/product/${p.slug}`} className="font-grotesk text-sm">
                    {p.name}
                  </Link>
                  <span className="font-mono text-sm shrink-0">{formatGBP(p.price)}</span>
                </div>
                <button
                  onClick={() => cart.add(p.slug)}
                  className={`mt-2 w-full py-2 font-mono text-[10px] uppercase tracking-[0.15em] border ${cart.has(p.slug) ? "border-mg-accent text-mg-accent" : "border-mg-bd/25 hover:bg-mg-fg hover:text-mg-bg"}`}
                >
                  {cart.has(p.slug) ? "Added ✓" : "Add to bag"}
                </button>
              </div>
            )
        )}
      </div>
    </section>
  );
}
