"use client";

import type { PublicVariant } from "@/lib/domain/variants";
import { isVariantSellable } from "@/lib/domain/variants";

/**
 * The PDP's option row — the public face `product_variants` never had.
 *
 * **Its own component rather than more JSX in `ProductView`** because the
 * selection rules are the interesting part and they are worth reading in one
 * place: which options exist, which can be bought, and which one is showing.
 * `ProductView` stays what it was, a layout file.
 *
 * **Rendered only when a product has variants**, which is why this can be
 * additive to a pixel-verified page: the sixteen seeded products carry no
 * variant rows, so every baseline screenshot renders exactly the markup it did
 * before. The picker appears the moment a merchant adds a size and not one
 * moment sooner.
 *
 * The visual language is the gallery thumbnails' — a bordered box that takes
 * the accent border when it is the chosen one — because that is the selection
 * idiom this page already has. No new one was invented.
 */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: PublicVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="mt-6">
      <h2
        id="mg-variant-label"
        className="font-mono uppercase text-[11px] tracking-[0.2em] text-mg-fg/50"
      >
        Options
      </h2>
      {/* A group rather than a radiogroup: a radiogroup owes the reader roving
          tabindex and arrow-key navigation, and a row of toggle buttons that
          each announce their own pressed state is the honest description of
          what this is. `aria-pressed` is what carries the selection. */}
      <div role="group" aria-labelledby="mg-variant-label" className="mt-3 flex flex-wrap gap-2">
        {variants.map((variant) => {
          const sellable = isVariantSellable(variant);
          const selected = variant.id === selectedId;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              aria-pressed={selected}
              // Disabled rather than merely styled: an option that cannot be
              // bought should not be reachable by keyboard either, and a
              // shopper who tabs onto one and presses Enter has been told
              // nothing. The label carries the reason so a screen reader gets
              // it too, not just the strike-through.
              disabled={!sellable}
              aria-label={sellable ? variant.title : `${variant.title} — unavailable`}
              className={[
                "border px-4 py-2 font-mono uppercase text-[11px] tracking-[0.15em] transition-colors",
                selected
                  ? "border-mg-accent text-mg-accent"
                  : "border-mg-bd/25 hover:border-mg-bd/60",
                sellable ? "" : "cursor-not-allowed text-mg-fg/35 line-through",
              ].join(" ")}
            >
              {variant.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
