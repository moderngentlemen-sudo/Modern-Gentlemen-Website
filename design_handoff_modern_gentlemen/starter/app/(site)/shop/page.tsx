"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { groups, useCatalog } from "@/lib/catalog/CatalogProvider";
import { formatGBP } from "@/lib/domain/money";
import { useCart } from "@/lib/cart/CartProvider";
import { ProductCard } from "@/components/store/ProductCard";

/**
 * The store.
 *
 * ⚠️ **The fallback is the point of this shape, not a placeholder.**
 * `useSearchParams` opts its subtree out of prerendering, so whatever sits in
 * the Suspense fallback is what ends up in the static HTML — and this fallback
 * used to be `<ShopHero />` alone. The consequence was invisible to users and to
 * the visual suite, which drives a real browser and waits for hydration: the
 * store's sixteen products **were not in the served HTML at all**, only in the
 * flight payload. `/shop` shipped a headline and a chip row to anything that
 * does not run JavaScript, the PDP meanwhile rendering in full.
 *
 * So the fallback renders the whole store, unfiltered — which is what `/shop`
 * with no query string means anyway, and the canonical every filtered view
 * already points at (see `layout.tsx`). Filtering stays a client enhancement.
 *
 * **The page stays `○` static, which is the constraint that shaped this.** The
 * obvious alternative — read `searchParams` on the server and filter there —
 * renders the correct grid for every URL and turns the store into a per-request
 * render. Prerendering the unfiltered store and letting the browser narrow it
 * keeps both properties.
 */
export default function ShopPage() {
  // useSearchParams must sit under a Suspense boundary (Next 15).
  return (
    <Suspense fallback={<Store active="All" />}>
      <Shop />
    </Suspense>
  );
}

/** The filtered store: everything below, plus the query string that narrows it. */
function Shop() {
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("cat") || "";
  const active = groups.find((g) => g.toLowerCase() === raw.toLowerCase()) ?? "All";

  const setActive = (g: string) =>
    router.replace(g === "All" ? "/shop" : `/shop?cat=${g}`, { scroll: false });

  return <Store active={active} setActive={setActive} />;
}

/**
 * The store's markup, identical for both renderings.
 *
 * `setActive` is optional because the prerendered pass has no router: the chips
 * draw and are inert until hydration, exactly as they were when the fallback was
 * the hero alone.
 */
function Store({ active, setActive }: { active: string; setActive?: (g: string) => void }) {
  const cart = useCart();
  const { allProducts, byGroup } = useCatalog();
  const [added, setAdded] = useState<string | null>(null);

  const products = active === "All" ? allProducts() : byGroup(active);

  const onAdd = (slug: string) => {
    cart.add(slug, 1);
    setAdded(slug);
  };

  const empty = cart.count === 0;

  return (
    <>
      <ShopHero active={active} setActive={setActive} />

      <div className="container-mg">
        <div className="grid grid-cols-1 min-[461px]:grid-cols-2 min-[1024px]:grid-cols-4 gap-5 py-10">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} added={added === p.slug} onAdd={onAdd} />
          ))}
        </div>

        {/* Cart note */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-mg-bd/15 py-5">
          <p className="font-mono uppercase text-xs tracking-[0.15em] text-mg-fg/60">
            {empty
              ? "Your bag is empty — members get free shipping over £50."
              : `${cart.count} item${cart.count === 1 ? "" : "s"} in your bag · ${formatGBP(cart.subtotal)} · free shipping over £50`}
          </p>
          {!empty && (
            <Link
              href="/bag"
              className="font-mono uppercase text-xs tracking-[0.2em] text-mg-accentInk"
            >
              View bag →
            </Link>
          )}
        </div>
      </div>

      {/* Members band */}
      <section data-darkband className="mt-16 bg-mg-accent text-white">
        <div className="container-mg flex flex-wrap items-center justify-between gap-6 py-12">
          <div>
            <p className="font-mono uppercase text-[11px] tracking-[0.2em] text-white/90">
              Members save 15%
            </p>
            <p className="mt-2 font-grotesk text-2xl md:text-3xl">Every order, every time.</p>
          </div>
          <Link
            href="/membership"
            className="border border-white/60 px-6 py-3 font-mono uppercase text-xs tracking-[0.2em] transition-colors hover:bg-white hover:text-mg-accentInk"
          >
            Become a member →
          </Link>
        </div>
      </section>
    </>
  );
}

function ShopHero({
  active = "All",
  setActive,
}: {
  active?: string;
  setActive?: (g: string) => void;
}) {
  return (
    <div className="container-mg border-b border-mg-bd/10 pt-10 pb-8 md:pt-16">
      <p className="font-mono uppercase text-xs tracking-[0.28em] text-mg-accentInk">
        The MG Store
      </p>
      <h1 className="mt-4 font-grotesk font-semibold text-5xl md:text-7xl tracking-[-0.03em] text-balance">
        Objects worth keeping.
      </h1>
      <p className="mt-6 max-w-xl font-serif italic text-xl text-mg-fg/60 md:text-2xl">
        A short, honest list of things we actually use — chosen to last, tested by the desk.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActive?.(g)}
            aria-pressed={active === g}
            className={`border px-4 py-2 font-mono uppercase text-[11px] tracking-[0.15em] transition-colors ${
              active === g
                ? "border-mg-accent bg-mg-accent text-white"
                : "border-mg-bd/25 hover:border-mg-accent"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
