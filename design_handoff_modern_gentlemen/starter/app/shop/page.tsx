"use client";

import { useState } from "react";
import Link from "next/link";
import { allProducts, byGroup, groups, formatGBP } from "@/lib/catalog";
import { useCart } from "@/lib/cart/CartProvider";

export default function ShopPage() {
  const [group, setGroup] = useState<string>("All");
  const products = group === "All" ? allProducts() : byGroup(group);
  const cart = useCart();

  return (
    <div className="container-mg py-12 md:py-16">
      <h1 className="font-grotesk font-semibold text-4xl md:text-5xl">The Shop</h1>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mt-8">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={`font-mono text-xs uppercase tracking-[0.15em] px-4 py-2 border ${
              group === g ? "bg-mg-accent text-white border-mg-accent" : "border-mg-bd/25 hover:border-mg-accent"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
        {products.map((p) => {
          const inBag = cart.has(p.slug);
          return (
            <div key={p.slug} className="group">
              <Link href={`/product/${p.slug}`}>
                <div className="relative aspect-[4/5] overflow-hidden bg-mg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={"/" + p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {p.tag && <span className="absolute top-3 left-3 bg-mg-accent text-white font-mono text-[10px] px-2 py-1 tracking-widest">{p.tag}</span>}
                </div>
              </Link>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <Link href={`/product/${p.slug}`} className="font-grotesk text-sm leading-snug">{p.name}</Link>
                <span className="font-mono text-sm shrink-0">{formatGBP(p.price)}</span>
              </div>
              <button
                onClick={() => cart.add(p.slug)}
                className={`mt-3 w-full py-2 font-mono text-xs uppercase tracking-[0.15em] border ${
                  inBag ? "border-mg-accent text-mg-accent" : "border-mg-bd/30 hover:bg-mg-fg hover:text-mg-bg"
                }`}
              >
                {inBag ? "Added ✓" : "Add to bag"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
