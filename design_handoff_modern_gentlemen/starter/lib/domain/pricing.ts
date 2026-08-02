/**
 * Cart pricing — the single source of truth for the commerce rules in
 * `CLAUDE.md`: member discount 15%, free shipping at £50 or more, otherwise
 * £4.95, and qty 0 removes a line.
 *
 * This module is pure and framework-free on purpose. The same function backs
 * the client cart, server-rendered order summaries, and the admin. Totals must
 * never be computed in two places — that is how a storefront and a receipt end
 * up disagreeing.
 */
import {
  applyRate,
  FREE_SHIPPING_THRESHOLD,
  MEMBER_DISCOUNT_RATE,
  STANDARD_SHIPPING,
  type Pence,
} from "./money";

export interface PricedLine {
  /** Unit price in canonical pence. */
  unitPrice: Pence;
  qty: number;
}

export interface CartTotals {
  subtotal: Pence;
  memberDiscount: Pence;
  /** Subtotal less any member discount — what shipping is assessed against. */
  payable: Pence;
  shipping: Pence;
  total: Pence;
}

export interface PricingOptions {
  isMember?: boolean;
  /** Overridable so tests and future promotions do not hardcode the rate. */
  memberRate?: number;
  freeShippingThreshold?: Pence;
  standardShipping?: Pence;
}

export function calculateTotals(
  lines: readonly PricedLine[],
  options: PricingOptions = {}
): CartTotals {
  const {
    isMember = false,
    memberRate = MEMBER_DISCOUNT_RATE,
    freeShippingThreshold = FREE_SHIPPING_THRESHOLD,
    standardShipping = STANDARD_SHIPPING,
  } = options;

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const memberDiscount = isMember ? applyRate(subtotal, memberRate) : 0;
  const payable = subtotal - memberDiscount;

  // Matches the prototype exactly: an empty (or fully discounted) cart never
  // attracts shipping, and the threshold is tested against the discounted
  // amount, not the gross subtotal.
  const shipping = payable === 0 || payable >= freeShippingThreshold ? 0 : standardShipping;

  return { subtotal, memberDiscount, payable, shipping, total: payable + shipping };
}

/**
 * Normalise a quantity change. `CLAUDE.md`: "qty 0 removes".
 * Returns null when the line should be dropped.
 */
export function normaliseQty(qty: number): number | null {
  if (!Number.isFinite(qty)) return null;
  const next = Math.floor(qty);
  return next <= 0 ? null : next;
}
