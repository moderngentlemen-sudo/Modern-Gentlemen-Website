"use client";

import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";

/**
 * Order summary — shared by the Bag page (full, with a CHECKOUT CTA) and the
 * Checkout rail (`showItems` compact variant). Reads live values from useCart().
 */
export function OrderSummary({
  heading = "Order Summary",
  showItems = false,
  cta,
  secondary,
  footNote,
}: {
  heading?: string;
  showItems?: boolean;
  cta?: { label: string; href: string };
  secondary?: React.ReactNode;
  footNote?: string;
}) {
  const cart = useCart();
  return (
    <div className="border border-mg-bd/15 p-6">
      <h2 className="mb-4 font-mono uppercase text-xs tracking-[0.2em] text-mg-accentInk">
        {heading}
      </h2>

      {showItems && (
        <ul className="mb-4 space-y-2 border-b border-mg-bd/10 pb-4">
          {cart.lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-3 text-sm">
              <span className="text-mg-fg/70">
                {l.product.name}
                {l.variant && <span className="text-mg-fg/45"> · {l.variant.title}</span>}{" "}
                <span className="text-mg-fg/40">× {l.qty}</span>
              </span>
              <span className="shrink-0 font-mono">{formatGBP(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}

      <Row label="Subtotal" value={formatGBP(cart.subtotal)} />
      {cart.isMember && cart.memberDiscount > 0 && (
        <Row label="Member discount (15%)" value={`– ${formatGBP(cart.memberDiscount)}`} accent />
      )}
      <Row label="Shipping" value={cart.shipping === 0 ? "Free" : formatGBP(cart.shipping)} />
      <div className="mt-3 border-t border-mg-bd/15 pt-3">
        <Row label="Total" value={formatGBP(cart.total)} bold />
      </div>

      {cta && (
        <Link
          href={cta.href}
          className="mt-6 block bg-mg-accent py-3 text-center font-mono uppercase text-xs tracking-[0.2em] text-white transition-colors hover:bg-mg-fg hover:text-mg-bg"
        >
          {cta.label}
        </Link>
      )}
      {secondary}
      {footNote && (
        <p className="mt-4 text-center font-mono uppercase text-[10px] tracking-[0.12em] text-mg-fg/40">
          {footNote}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${bold ? "font-grotesk text-lg" : `text-sm ${accent ? "text-mg-accentSerif" : "text-mg-fg/70"}`}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
