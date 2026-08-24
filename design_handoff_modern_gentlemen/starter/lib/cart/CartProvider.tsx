"use client";

/**
 * Local cart adapter — ports mg-bag.js (design_files/) to a React context.
 * Rules preserved: member discount 15%, free shipping >= £50 else £4.95, qty 0 removes.
 * Swap this whole provider for a Shopify adapter later WITHOUT touching UI —
 * it just has to satisfy CartApi (lib/cart/types.ts). See 01_ARCHITECTURE.md.
 *
 * NOTE: only ever touch the localStorage keys we own: "mg-bag" and "mg-member".
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartApi, CartLine, EnrichedLine } from "./types";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { calculateTotals, normaliseQty } from "@/lib/domain/pricing";
import { MEMBER_DISCOUNT_RATE, penceToPounds, poundsToPence } from "@/lib/domain/money";
import { cartLineKey, defaultVariant, findVariant, variantPricePence } from "@/lib/domain/variants";

const BAG_KEY = "mg-bag";
const MEMBER_KEY = "mg-member";

/**
 * An enriched line plus the unit price in the unit the totals are computed in.
 *
 * `unitPence` stays inside this module: `EnrichedLine` is the contract the
 * pixel-verified store components read, and every money field on it is pounds.
 * Adding a second unit to the public type would be an invitation to pick the
 * wrong one at a call site.
 */
type PricedLine = EnrichedLine & { unitPence: number };

const CartContext = createContext<CartApi | null>(null);

/**
 * The stored bag, validated.
 *
 * `localStorage` is user-writable and this used to `JSON.parse` straight into
 * `CartLine[]` and trust the result — the `try` caught malformed *JSON* and
 * nothing else, so `[{"slug": 1, "qty": 1.5}]` parsed cleanly into a shape the
 * type says is impossible.
 *
 * That was survivable while a line total was `product.price * qty` in pounds:
 * a fractional quantity produced a wrong number, silently. It stopped being
 * survivable when the totals moved to integer pence, because `penceToPounds`
 * asserts its argument and a fractional qty would now **throw during render**.
 * Validating here rather than guarding the multiplication fixes the class
 * rather than the instance — `count` sums these too, and summed unvalidated.
 */
function readBag(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): CartLine[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { slug, qty, variantId } = entry as Record<string, unknown>;

      if (typeof slug !== "string" || slug === "") return [];
      // The same rule the cart applies to a quantity change, so a stored 0 or
      // a negative drops the line exactly as `setQty(key, 0)` would.
      const quantity = normaliseQty(typeof qty === "number" ? qty : Number.NaN);
      if (quantity === null) return [];

      return [{ slug, qty: quantity, ...(typeof variantId === "string" ? { variantId } : {}) }];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // The catalogue arrives from the server layout above. Resolution stays
  // synchronous, exactly as it was when this read a hardcoded module — the
  // source moved, the contract did not.
  const { getProduct } = useCatalog();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isMember, setIsMember] = useState(false);

  // Hydrate from localStorage + subscribe to cross-tab changes.
  useEffect(() => {
    setLines(readBag());
    setIsMember(localStorage.getItem(MEMBER_KEY) === "1");
    const onStorage = (e: StorageEvent) => {
      if (e.key === BAG_KEY) setLines(readBag());
      if (e.key === MEMBER_KEY) setIsMember(localStorage.getItem(MEMBER_KEY) === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (next: CartLine[]) => {
    setLines(next);
    localStorage.setItem(BAG_KEY, JSON.stringify(next));
  };

  const api = useMemo<CartApi>(() => {
    // Enrichment carries the unit price in pence alongside the pounds one,
    // because a variant's price *is* pence and the product's is pounds. Doing
    // the conversion once, here, is what keeps the totals below exact: a line
    // total used to be `product.price * qty` in pounds, which is exact only
    // while every price is a whole number of pounds. A variant at £159.99 makes
    // that false — 159.99 * 3 is 479.96999999999997 — and the bug would have
    // been a penny on a receipt, not a crash.
    const enriched: PricedLine[] = lines
      .map((l): PricedLine | null => {
        const product = getProduct(l.slug);
        if (!product) return null;

        const variant = findVariant(product.variants, l.variantId);
        // A deleted variant prices as the product. `findVariant` returns null
        // for a stale id and `variantPricePence` falls back, so a bag that
        // outlived a merchant's edit still shows a price rather than NaN.
        const unitPence = variantPricePence(poundsToPence(product.price), variant);

        return {
          ...l,
          product,
          key: cartLineKey(l.slug, l.variantId),
          variant,
          unitPence,
          unitPrice: penceToPounds(unitPence),
          lineTotal: penceToPounds(unitPence * l.qty),
        };
      })
      .filter((l): l is PricedLine => l !== null);

    // Totals are computed by lib/domain/pricing in exact integer pence, then
    // converted back to pounds at this boundary so CartApi keeps its existing
    // shape. The rules themselves live in one place, shared with the server.
    const totals = calculateTotals(
      enriched.map((l) => ({ unitPrice: l.unitPence, qty: l.qty })),
      { isMember }
    );

    return {
      lines: enriched,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: penceToPounds(totals.subtotal),
      isMember,
      memberRate: MEMBER_DISCOUNT_RATE,
      memberDiscount: penceToPounds(totals.memberDiscount),
      shipping: penceToPounds(totals.shipping),
      total: penceToPounds(totals.total),
      // Any variation counts: this drives the cards' "Added ✓" state, and a
      // shopper who has the medium in their bag has *this product* in it.
      has: (slug) => lines.some((l) => l.slug === slug),
      add: (slug, qty = 1, variantId) => {
        // A quick-add from a card passes no variant because a card has no
        // picker. Resolving the default here rather than making every call site
        // do it is what keeps `cart.add(p.slug)` correct on ProductRow, /shop
        // and anywhere else — and it means a variant product can never enter
        // the bag as an unpriced, unnamed line.
        const product = getProduct(slug);
        const resolved =
          variantId !== undefined
            ? variantId
            : (defaultVariant(product?.variants ?? [])?.id ?? null);

        const key = cartLineKey(slug, resolved);
        const found = lines.find((l) => cartLineKey(l.slug, l.variantId) === key);

        persist(
          found
            ? lines.map((l) =>
                cartLineKey(l.slug, l.variantId) === key ? { ...l, qty: l.qty + qty } : l
              )
            : [...lines, { slug, qty, ...(resolved ? { variantId: resolved } : {}) }]
        );
      },
      setQty: (key, qty) => {
        // "qty 0 removes" (CLAUDE.md) — the rule lives in lib/domain/pricing.
        const next = normaliseQty(qty);
        const matches = (l: CartLine) => cartLineKey(l.slug, l.variantId) === key;
        persist(
          next === null
            ? lines.filter((l) => !matches(l))
            : lines.map((l) => (matches(l) ? { ...l, qty: next } : l))
        );
      },
      remove: (key) => persist(lines.filter((l) => cartLineKey(l.slug, l.variantId) !== key)),
      clear: () => persist([]),
      setMember: (v) => {
        setIsMember(v);
        localStorage.setItem(MEMBER_KEY, v ? "1" : "0");
      },
    };
  }, [lines, isMember, getProduct]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

// Money formatting has a single source of truth in lib/domain/money; re-export
// it so callers importing from here keep working AND shipping renders £4.95
// (not £5). `money.test.ts` pins it against the demo catalog's original, which
// is what proves the port did not change a single rendered price.
export { formatGBP } from "@/lib/domain/money";
