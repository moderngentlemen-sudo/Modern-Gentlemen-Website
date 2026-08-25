import Link from "next/link";
import type { Product } from "@/lib/cart/types";
import { formatGBP } from "@/lib/domain/money";
import { MediaImage } from "../ui/MediaImage";

/**
 * Store product card — bordered surface tile. Used by the Shop grid and the PDP
 * "related" row. When `onAdd` is given it shows an inline ADD pill whose label is
 * caller-controlled via `added` (Shop tracks a single last-added slug); without
 * it the card is a plain link (related row).
 */
export function ProductCard({
  product,
  added,
  onAdd,
}: {
  product: Product;
  added?: boolean;
  onAdd?: (slug: string) => void;
}) {
  return (
    <article className="group flex flex-col border border-mg-bd/15 bg-mg-surface">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden"
      >
        {/* `images` hold ready-to-use URLs. They used to be root-relative paths
            with the slash added here, which cannot work once an image is a real
            uploaded asset on an absolute Supabase URL. */}
        <MediaImage
          src={product.images[0]}
          alt={product.name}
          slot="quarter"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
        {product.tag && (
          <span className="absolute top-3 left-3 bg-mg-accent text-white font-mono uppercase text-[10px] tracking-[0.18em] px-2 py-1">
            {product.tag}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-mono uppercase text-[9px] tracking-[0.2em] text-mg-fg/45">
          {product.catLabel}
        </span>
        <Link
          href={`/product/${product.slug}`}
          className="mt-1 font-grotesk text-[17px] leading-snug hover:text-mg-accentInk"
        >
          {product.name}
        </Link>
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <span className="font-mono text-sm">{formatGBP(product.price)}</span>
          {onAdd && (
            <button
              type="button"
              onClick={() => onAdd(product.slug)}
              className={`font-mono uppercase text-[11px] tracking-[0.15em] px-4 py-2 border transition-colors ${
                added
                  ? "border-mg-accent text-mg-accentInk"
                  : "border-mg-bd/25 hover:bg-mg-accent hover:text-white hover:border-mg-accent"
              }`}
            >
              {added ? "Added ✓" : "Add"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
