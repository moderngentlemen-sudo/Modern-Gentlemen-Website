"use client";

import Link from "next/link";

import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCard } from "@/components/store/ProductCard";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPence, poundsToPence } from "@/lib/domain/money";
import { cardPricePence } from "@/lib/domain/variants";

export function NativeProduct({
  slug,
  layout = "card",
  showCategory = true,
  showPrice = true,
  showAdd = true,
}: {
  slug: string;
  layout?: "card" | "compact";
  showCategory?: boolean;
  showPrice?: boolean;
  showAdd?: boolean;
}) {
  const catalog = useCatalog();
  const cart = useCart();
  const product = catalog.getProduct(slug);
  if (!product) return null;

  if (layout === "card" && showCategory && showPrice) {
    return (
      <ProductCard
        product={product}
        added={cart.has(product.slug)}
        onAdd={showAdd ? (productSlug) => cart.add(productSlug) : undefined}
      />
    );
  }

  const price = cardPricePence(poundsToPence(product.price), product.variants);
  return (
    <article className="flex items-center gap-4 border-y border-mg-bd/15 py-4">
      <Link
        href={`/product/${product.slug}`}
        className="relative block h-24 w-20 shrink-0 overflow-hidden bg-mg-surface"
      >
        <MediaImage
          src={product.images[0]}
          alt={product.name}
          slot="thumb"
          className="object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        {showCategory && (
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mg-fg/60">
            {product.catLabel}
          </div>
        )}
        <Link
          href={`/product/${product.slug}`}
          className="mt-1 block font-grotesk text-[17px] leading-tight hover:text-mg-accentInk"
        >
          {product.name}
        </Link>
        {showPrice && (
          <div className="mt-2 font-mono text-[12px]">
            {price.from ? "From " : ""}
            {formatPence(price.pence)}
          </div>
        )}
      </div>
      {showAdd && (
        <button
          type="button"
          onClick={() => cart.add(product.slug)}
          className="shrink-0 border border-mg-bd/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] hover:border-mg-accent hover:text-mg-accentInk"
        >
          {cart.has(product.slug) ? "Added ✓" : "Add"}
        </button>
      )}
    </article>
  );
}
