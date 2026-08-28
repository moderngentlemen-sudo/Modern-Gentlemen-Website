"use client";

import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";
import { QtyStepper } from "@/components/store/QtyStepper";
import { OrderSummary } from "@/components/store/OrderSummary";

export default function BagPage() {
  const cart = useCart();
  const label = cart.count === 0 ? "Empty" : `${cart.count} item${cart.count === 1 ? "" : "s"}`;

  return (
    <div className="container-mg py-12 md:py-16">
      <div className="mb-8 flex items-baseline gap-4">
        <h1 className="font-grotesk font-semibold text-3xl md:text-4xl">Your Bag</h1>
        <span className="font-mono uppercase text-xs tracking-[0.2em] text-mg-fg/60">{label}</span>
      </div>

      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BagIcon />
          <p className="mt-6 font-serif italic text-2xl text-mg-fg/70">Your bag is empty.</p>
          <Link
            href="/shop"
            className="mt-6 inline-block border border-mg-bd/30 px-6 py-3 font-mono uppercase text-xs tracking-[0.2em] transition-colors hover:bg-mg-fg hover:text-mg-bg"
          >
            Browse the store →
          </Link>
        </div>
      ) : (
        <div className="grid gap-12 min-[901px]:grid-cols-[1.5fr_0.5fr]">
          {/* Line items */}
          <div>
            <ul className="divide-y divide-mg-bd/10 border-y border-mg-bd/10">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex gap-4 py-6 sm:gap-5">
                  <Link
                    href={`/product/${l.slug}`}
                    className="h-[104px] w-20 shrink-0 overflow-hidden bg-mg-surface sm:h-[130px] sm:w-[104px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={"/" + l.product.images[0]}
                      alt={l.product.name}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-mono uppercase text-[10px] tracking-[0.2em] text-mg-fg/60">
                      {l.product.catLabel}
                    </span>
                    <Link
                      href={`/product/${l.slug}`}
                      className="mt-1 font-grotesk text-lg hover:text-mg-accentInk"
                    >
                      {l.product.name}
                    </Link>
                    {l.variant && (
                      <p className="mt-1 font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/60">
                        {l.variant.title}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs text-mg-fg/60">
                      {formatGBP(l.unitPrice)} each
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-4">
                      <QtyStepper
                        qty={l.qty}
                        onDec={() => cart.setQty(l.key, l.qty - 1)}
                        onInc={() => cart.setQty(l.key, l.qty + 1)}
                      />
                      <button
                        onClick={() => cart.remove(l.key)}
                        className="py-1.5 font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/60 hover:text-mg-accentInk"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-sm">{formatGBP(l.lineTotal)}</div>
                </li>
              ))}
            </ul>
            <Link
              href="/shop"
              className="mt-6 inline-block font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accentInk"
            >
              ← Continue shopping
            </Link>
          </div>

          {/* Summary */}
          <div className="self-start min-[901px]:sticky min-[901px]:top-24">
            <OrderSummary
              heading="Order Summary"
              cta={{ label: "Checkout →", href: "/checkout" }}
              secondary={
                !cart.isMember ? (
                  <Link
                    href="/membership"
                    className="mt-3 block text-center font-mono uppercase text-[11px] tracking-[0.12em] text-mg-fg/60 hover:text-mg-accentInk"
                  >
                    Members save 15% — become a member
                  </Link>
                ) : undefined
              }
              footNote="Secure checkout"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BagIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-mg-fg/60"
    >
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
