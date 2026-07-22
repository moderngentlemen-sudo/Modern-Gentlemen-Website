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
import { getProduct } from "@/lib/catalog";

const BAG_KEY = "mg-bag";
const MEMBER_KEY = "mg-member";
const MEMBER_RATE = 0.15;

const CartContext = createContext<CartApi | null>(null);

function readBag(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
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
    const enriched: EnrichedLine[] = lines
      .map((l) => {
        const product = getProduct(l.slug);
        if (!product) return null;
        return { ...l, product, lineTotal: product.price * l.qty };
      })
      .filter(Boolean) as EnrichedLine[];

    const subtotal = enriched.reduce((s, l) => s + l.lineTotal, 0);
    const memberDiscount = isMember ? Math.round(subtotal * MEMBER_RATE) : 0;
    const afterDiscount = subtotal - memberDiscount;
    const shipping = enriched.length === 0 || afterDiscount >= 50 ? 0 : 4.95;

    return {
      lines: enriched,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal,
      isMember,
      memberRate: MEMBER_RATE,
      memberDiscount,
      shipping,
      total: afterDiscount + shipping,
      has: (slug) => lines.some((l) => l.slug === slug),
      add: (slug, qty = 1) => {
        const found = lines.find((l) => l.slug === slug);
        persist(
          found
            ? lines.map((l) => (l.slug === slug ? { ...l, qty: l.qty + qty } : l))
            : [...lines, { slug, qty }]
        );
      },
      setQty: (slug, qty) =>
        persist(qty <= 0 ? lines.filter((l) => l.slug !== slug) : lines.map((l) => (l.slug === slug ? { ...l, qty } : l))),
      remove: (slug) => persist(lines.filter((l) => l.slug !== slug)),
      clear: () => persist([]),
      setMember: (v) => {
        setIsMember(v);
        localStorage.setItem(MEMBER_KEY, v ? "1" : "0");
      },
    };
  }, [lines, isMember]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

// Money formatting has a single source of truth in lib/catalog; re-export it so
// callers importing from here keep working AND shipping renders £4.95 (not £5).
export { formatGBP } from "@/lib/catalog";
