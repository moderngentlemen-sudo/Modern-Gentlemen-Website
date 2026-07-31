/**
 * Money — the canonical internal unit is **integer pence**.
 *
 * Why not pounds-as-float: 0.1 + 0.2 !== 0.3, and a 15% member discount on a
 * £145 subtotal is £21.75 — a value that only survives exact arithmetic. All
 * pricing maths therefore happens in integer pence, and pounds appear only at
 * the boundaries (the catalog, the `numeric(10,2)` columns, and display).
 *
 * Display formatting is deliberately byte-identical to the original
 * `lib/catalog.ts#formatGBP`, so no rendered price changes: whole amounts show
 * no decimals ("£145"), fractional amounts show their pence ("£4.95").
 */

/** An amount in integer pence. Negative values are valid (refunds, deltas). */
export type Pence = number;

export const MEMBER_DISCOUNT_RATE = 0.15;
export const FREE_SHIPPING_THRESHOLD: Pence = 5_000; // £50.00
export const STANDARD_SHIPPING: Pence = 495; // £4.95

/** Convert pounds (catalog + `numeric(10,2)` columns) to canonical pence. */
export function poundsToPence(pounds: number): Pence {
  if (!Number.isFinite(pounds)) throw new RangeError(`Not a finite amount: ${pounds}`);
  // Scaling alone is not enough: 145.15 * 100 is 14514.999999999998 and
  // 1.005 * 100 is 100.49999999999999, so a bare Math.round() rounds both the
  // wrong way. Collapsing the scaled value to 4 decimal places first discards
  // the representation error while preserving any genuine sub-penny fraction,
  // and only then do we round to a whole penny.
  return Math.round(Number((pounds * 100).toFixed(4)));
}

/** Convert canonical pence back to pounds, for display or `numeric(10,2)` storage. */
export function penceToPounds(pence: Pence): number {
  assertPence(pence);
  return pence / 100;
}

/**
 * Format pounds exactly as the existing site does.
 * Kept operating on pounds so its output is unchanged from `catalog.ts`.
 */
export function formatGBP(pounds: number): string {
  return "£" + Number(pounds).toLocaleString("en-GB");
}

/** Format canonical pence for display. */
export function formatPence(pence: Pence): string {
  return formatGBP(penceToPounds(pence));
}

/** Apply a rate to an amount, rounding to the nearest whole penny. */
export function applyRate(amount: Pence, rate: number): Pence {
  assertPence(amount);
  return Math.round(amount * rate);
}

function assertPence(value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(
      `Money must be integer pence, received ${value}. Use poundsToPence() at the boundary.`
    );
  }
}
