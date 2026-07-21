"use client";

import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";

export default function BagPage() {
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="container-mg py-32 text-center">
        <h1 className="font-grotesk text-3xl">Your bag is empty.</h1>
        <Link href="/shop" className="inline-block mt-6 font-mono text-xs uppercase tracking-[0.2em] text-mg-accent">Continue shopping →</Link>
      </div>
    );
  }

  return (
    <div className="container-mg py-12 md:py-16 grid lg:grid-cols-[1fr_360px] gap-12">
      {/* Line items */}
      <div>
        <h1 className="font-grotesk font-semibold text-3xl mb-8">Your Bag</h1>
        <ul className="divide-y divide-mg-bd/10">
          {cart.lines.map((l) => (
            <li key={l.slug} className="flex gap-4 py-5">
              <div className="h-24 w-20 shrink-0 overflow-hidden bg-mg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={"/" + l.product.images[0]} alt={l.product.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1">
                <Link href={`/product/${l.slug}`} className="font-grotesk">{l.product.name}</Link>
                <p className="font-mono text-xs text-mg-fg/50 mt-1">{formatGBP(l.product.price)} each</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-mg-bd/30">
                    <button className="px-3" onClick={() => cart.setQty(l.slug, l.qty - 1)}>–</button>
                    <span className="px-3 font-mono text-sm">{l.qty}</span>
                    <button className="px-3" onClick={() => cart.setQty(l.slug, l.qty + 1)}>+</button>
                  </div>
                  <button className="font-mono text-xs text-mg-fg/50 hover:text-mg-accent" onClick={() => cart.remove(l.slug)}>Remove</button>
                </div>
              </div>
              <div className="font-mono text-sm">{formatGBP(l.lineTotal)}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 self-start border border-mg-bd/15 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-4">Order Summary</h2>
        <Row label="Subtotal" value={formatGBP(cart.subtotal)} />
        {cart.memberDiscount > 0 && <Row label="Member discount" value={`– ${formatGBP(cart.memberDiscount)}`} />}
        <Row label="Shipping" value={cart.shipping === 0 ? "Free" : formatGBP(cart.shipping)} />
        <div className="border-t border-mg-bd/15 mt-3 pt-3">
          <Row label="Total" value={formatGBP(cart.total)} bold />
        </div>
        <Link href="/checkout" className="mt-6 block text-center bg-mg-accent text-white py-3 font-mono text-xs uppercase tracking-[0.2em]">Checkout</Link>
        {!cart.isMember && (
          <Link href="/membership" className="mt-3 block text-center font-mono text-xs text-mg-fg/60 hover:text-mg-accent">Save 15% — become a member</Link>
        )}
        <p className="mt-4 font-mono text-[10px] text-mg-fg/40 text-center">Free shipping over £50 · secure checkout</p>
      </aside>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-grotesk text-lg" : "text-sm text-mg-fg/70"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
