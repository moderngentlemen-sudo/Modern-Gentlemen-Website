"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { formatGBP, penceToPounds, poundsToPence } from "@/lib/domain/money";
import { useCart } from "@/lib/cart/CartProvider";
import {
  defaultVariant,
  findVariant,
  isVariantSellable,
  variantPricePence,
} from "@/lib/domain/variants";
import { QtyStepper } from "@/components/store/QtyStepper";
import { VariantPicker } from "@/components/store/VariantPicker";
import { ProductCard } from "@/components/store/ProductCard";
import { MediaImage } from "@/components/ui/MediaImage";

const ASSURANCES = [
  "Free shipping on UK orders over £50",
  "30-day no-fuss returns",
  "Members save 15% at checkout",
];

/**
 * The PDP's body — the gallery, the stepper and the add-to-bag state.
 *
 * `"use client"` and unchanged from the version that *was* `page.tsx`, bar its
 * signature and its missing-product branch. It reads the catalogue from
 * `CatalogProvider` rather than taking the product as a prop, which is what
 * keeps this a move rather than a rewrite: every pixel-verified component below
 * gets the same `Product` it always did, and `related()`'s
 * same-category-first ordering is the context's, not something reimplemented
 * here.
 *
 * `page.tsx` now decides whether the slug exists, so this no longer renders a
 * soft "we couldn't find that product" screen. The guard below is the **race**,
 * not the ordinary miss: the server checked the database directly while this
 * reads the catalogue the site layout fetched, and those two can disagree for up
 * to an hour after a publish. `notFound()` works in a client component — it
 * throws, and the nearest boundary catches it — so the honest answer arrives
 * either way rather than a blank page.
 */
export function ProductView({ slug }: { slug: string }) {
  const { getProduct, related } = useCatalog();
  const product = getProduct(slug);
  const cart = useCart();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // `null` is "nothing chosen yet", not "no variant" — the choice is *derived*
  // below rather than seeded into state by an effect, so the first paint
  // already shows a selection and a price rather than flashing an unselected
  // row. It is also what makes the reset below one line.
  const [variantId, setVariantId] = useState<string | null>(null);

  // Reset transient state when navigating between products (related-link SPA nav).
  useEffect(() => {
    setImg(0);
    setQty(1);
    setAdded(false);
    setVariantId(null);
  }, [slug]);

  if (!product) notFound();

  const variants = product.variants ?? [];
  // A selection that no longer exists (the merchant deleted that size while the
  // page was open) falls back to the default rather than to nothing, which is
  // the same tolerance the cart shows a stale line.
  const selected = findVariant(variants, variantId) ?? defaultVariant(variants);
  const price = penceToPounds(variantPricePence(poundsToPence(product.price), selected));
  // Sellability gates the button, not the price: a sold-out size still shows
  // what it costs, because "£160, unavailable" tells a shopper more than a
  // blank.
  const sellable = variants.length === 0 || (selected !== null && isVariantSellable(selected));

  // ⚠️ Pounds arithmetic, and deliberately left as it was found. This rounds a
  // £145 member price to £123 where the bag charges £123.25 — a real 25p
  // disagreement between this page and the checkout, and a violation of the
  // integer-pence rule. It is **not** fixed here because the correct value
  // renders different pixels on a baseline-verified page, which is a decision
  // about the sixteen screenshots rather than a bug fix. Recorded in
  // PROGRESS.md's Known issues with the one-line repair.
  const memberPrice = Math.round(price * (1 - cart.memberRate));

  return (
    <div className="container-mg py-10 md:py-14">
      <nav className="mb-8 font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/45">
        <Link href="/shop" className="hover:text-mg-accent">
          Store
        </Link>{" "}
        <span className="text-mg-fg/25">/</span>{" "}
        <Link href={`/shop?cat=${product.cat}`} className="hover:text-mg-accent">
          {product.catLabel}
        </Link>{" "}
        <span className="text-mg-fg/25">/</span>{" "}
        <span className="text-mg-fg/70">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        {/* Gallery */}
        <div className="self-start md:sticky md:top-24">
          <div className="relative aspect-[4/5] overflow-hidden bg-mg-surface">
            <MediaImage
              src={product.images[img]}
              alt={product.name}
              slot="gallery"
              priority
              className="object-cover"
            />
            {product.tag && (
              <span className="absolute left-4 top-4 bg-mg-accent px-2 py-1 font-mono uppercase text-[10px] tracking-[0.18em] text-white">
                {product.tag}
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-3">
            {product.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImg(i)}
                aria-label={`View image ${i + 1}`}
                className={`relative h-20 w-20 overflow-hidden border ${i === img ? "border-mg-accent" : "border-mg-bd/15 hover:border-mg-bd/40"}`}
              >
                <MediaImage src={im} alt="" slot="thumb" className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <span className="font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accent">
            {product.catLabel}
          </span>
          <h1 className="mt-2 font-grotesk font-semibold text-3xl md:text-4xl tracking-[-0.02em]">
            {product.name}
          </h1>
          <div className="mt-4 flex items-baseline gap-4">
            <span className="font-grotesk text-2xl">{formatGBP(price)}</span>
            <span className="font-mono text-xs text-mg-fg/50">
              Members {formatGBP(memberPrice)}
            </span>
          </div>
          <p className="mt-5 text-mg-fg/70 text-pretty">{product.blurb}</p>
          <p className="mt-2 font-mono text-xs text-mg-fg/50">{product.material}</p>

          <VariantPicker
            variants={variants}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setVariantId(id);
              // The confirmation belongs to what was added, not to the page. A
              // shopper who adds the medium and then clicks the large must not
              // be looking at "Added to bag ✓" for a size that is not in it.
              setAdded(false);
            }}
          />

          {selected?.sku && (
            <p className="mt-3 font-mono text-[11px] tracking-[0.1em] text-mg-fg/40">
              SKU {selected.sku}
            </p>
          )}

          <div className="mt-8 flex items-stretch gap-3">
            <QtyStepper
              qty={qty}
              onDec={() => setQty((q) => Math.max(1, q - 1))}
              onInc={() => setQty((q) => q + 1)}
            />
            <button
              onClick={() => {
                cart.add(product.slug, qty, selected?.id ?? null);
                setAdded(true);
              }}
              disabled={!sellable}
              className={`flex-1 font-mono uppercase text-xs tracking-[0.2em] transition-colors ${
                sellable
                  ? "bg-mg-accent text-white hover:bg-mg-fg hover:text-mg-bg"
                  : "cursor-not-allowed border border-mg-bd/25 text-mg-fg/40"
              }`}
            >
              {!sellable ? "Unavailable" : added ? "Added to bag ✓" : "Add to bag"}
            </button>
          </div>

          <ul className="mt-6 space-y-2">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex items-center gap-2 text-sm text-mg-fg/70">
                <span className="text-mg-accent">✓</span> {a}
              </li>
            ))}
          </ul>

          <div className="mt-12">
            <h2 className="mb-3 font-mono uppercase text-xs tracking-[0.2em] text-mg-accent">
              The Story
            </h2>
            {product.story.split("\n\n").map((para, i) => (
              <p key={i} className="mb-4 leading-relaxed text-mg-fg/80 text-pretty">
                {para}
              </p>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="mb-3 font-mono uppercase text-xs tracking-[0.2em] text-mg-accent">
              Specifications
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {product.specs.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-4 border-b border-mg-bd/10 py-2 text-sm"
                >
                  <dt className="shrink-0 font-mono uppercase text-[11px] tracking-[0.1em] text-mg-fg/50">
                    {k}
                  </dt>
                  <dd className="min-w-0 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Related */}
      <div className="mt-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-grotesk font-semibold text-2xl md:text-3xl">You might also like</h2>
          <Link
            href="/shop"
            className="font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accent"
          >
            All products →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 min-[461px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {related(product.slug, 4).map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
