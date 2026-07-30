"use client";

import Link from "next/link";
import { OverlayScrim } from "./OverlayScrim";
import { useScrollLock } from "@/lib/useScrollLock";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";

/** Bag drawer — slide-in from the right. Live via CartProvider. */
export function BagDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  useScrollLock(open);

  return (
    <OverlayScrim open={open} onClose={onClose} align="right" label="Bag">
      <aside className="h-full w-full max-w-[440px] ml-auto bg-mg-surface text-mg-fg flex flex-col animate-[slideInRight_.26s_ease]">
        <div className="flex items-center justify-between p-6 border-b border-mg-bd/10">
          <div className="flex items-baseline gap-3">
            <span className="font-grotesk text-[15px]">Your Bag</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/50">
              {cart.count === 0 ? "Empty" : `${cart.count} ${cart.count === 1 ? "Item" : "Items"}`}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close bag" className="grid place-items-center h-10 w-10 rounded-full border border-mg-bd/20 text-lg leading-none">×</button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <p className="font-serif italic text-xl text-mg-fg/70">Your bag is empty.</p>
            <Link href="/shop" onClick={onClose} className="font-mono text-xs uppercase tracking-[0.2em] border border-mg-bd/30 px-6 py-3">Browse the store →</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-6 space-y-5">
              {cart.lines.map((l) => (
                <div key={l.slug} className="flex gap-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden bg-mg-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={"/" + l.product.images[0]} alt={l.product.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <Link href={`/product/${l.slug}`} onClick={onClose} className="font-grotesk text-sm">{l.product.name}</Link>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-mg-bd/25">
                        <button className="px-2" onClick={() => cart.setQty(l.slug, l.qty - 1)}>–</button>
                        <span className="px-2 font-mono text-xs">{l.qty}</span>
                        <button className="px-2" onClick={() => cart.setQty(l.slug, l.qty + 1)}>+</button>
                      </div>
                      <button className="font-mono text-[10px] text-mg-fg/50 hover:text-mg-accent" onClick={() => cart.remove(l.slug)}>Remove</button>
                    </div>
                  </div>
                  <span className="font-mono text-sm">{formatGBP(l.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-mg-bd/10 p-6 space-y-3">
              {cart.memberDiscount > 0 && (
                <div className="flex justify-between font-mono text-xs text-mg-accent"><span>Member discount</span><span>– {formatGBP(cart.memberDiscount)}</span></div>
              )}
              <div className="flex justify-between font-grotesk text-lg"><span>Subtotal</span><span className="font-mono">{formatGBP(cart.subtotal - cart.memberDiscount)}</span></div>
              <p className={`font-mono text-[10px] ${cart.shipping === 0 ? "text-[#5fd08a]" : "text-mg-fg/40"}`}>{cart.shipping === 0 ? "Free shipping included." : "Free shipping over £50."}</p>
              <Link href="/checkout" onClick={onClose} className="block text-center bg-mg-accent text-white py-3 font-mono text-xs uppercase tracking-[0.2em]">Checkout</Link>
              <Link href="/bag" onClick={onClose} className="block text-center font-mono text-[11px] text-mg-fg/60 hover:text-mg-accent">View full bag</Link>
            </div>
          </>
        )}
      </aside>
    </OverlayScrim>
  );
}
