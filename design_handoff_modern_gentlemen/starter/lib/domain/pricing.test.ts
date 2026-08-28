import { describe, expect, it } from "vitest";
import { calculateTotals, memberUnitPrice, normaliseQty } from "./pricing";
import { formatPence, poundsToPence } from "./money";

/** Catalog prices are whole pounds; convert at the boundary as the app does. */
const line = (pounds: number, qty = 1) => ({ unitPrice: poundsToPence(pounds), qty });

describe("calculateTotals", () => {
  it("sums line totals into a subtotal", () => {
    const totals = calculateTotals([line(145), line(52, 2)]);
    expect(totals.subtotal).toBe(poundsToPence(249));
  });

  it("charges no shipping on an empty cart", () => {
    const totals = calculateTotals([]);
    expect(totals).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });

  describe("shipping (CLAUDE.md: free at £50+, otherwise £4.95)", () => {
    it("charges £4.95 below the threshold", () => {
      expect(calculateTotals([line(49)]).shipping).toBe(495);
    });

    it("is free exactly at £50 — the boundary is inclusive", () => {
      expect(calculateTotals([line(50)]).shipping).toBe(0);
    });

    it("is free above the threshold", () => {
      expect(calculateTotals([line(145)]).shipping).toBe(0);
    });

    it("assesses the threshold against the DISCOUNTED amount, not the subtotal", () => {
      // £55 gross clears £50, but a member pays £46.75 — which does not.
      const totals = calculateTotals([line(55)], { isMember: true });
      expect(totals.subtotal).toBe(poundsToPence(55));
      expect(totals.payable).toBe(poundsToPence(46.75));
      expect(totals.shipping).toBe(495);
    });
  });

  describe("member discount (15%)", () => {
    it("applies no discount for non-members", () => {
      expect(calculateTotals([line(145)]).memberDiscount).toBe(0);
    });

    it("takes 15% to exact pence — £145 discounts by £21.75, not £22", () => {
      // Regression guard. The original port ran Math.round() over a POUNDS
      // value, rounding this discount to a whole £22 and overcharging by 25p.
      const totals = calculateTotals([line(145)], { isMember: true });
      expect(totals.memberDiscount).toBe(poundsToPence(21.75));
      expect(formatPence(totals.memberDiscount)).toBe("£21.75");
      expect(totals.total).toBe(poundsToPence(123.25));
    });

    it("rounds a half-penny discount to the nearest penny", () => {
      // £3.43 × 15% = 51.45p → 51p.
      const totals = calculateTotals([line(3.43)], { isMember: true });
      expect(totals.memberDiscount).toBe(51);
    });

    it("never lets floating point drift into the total", () => {
      const totals = calculateTotals([line(0.1), line(0.2)], { isMember: false });
      expect(totals.subtotal).toBe(30);
      expect(formatPence(totals.subtotal)).toBe("£0.3");
    });
  });

  it("combines discount and shipping in the documented order", () => {
    const totals = calculateTotals([line(20), line(15)], { isMember: true });
    expect(totals).toEqual({
      subtotal: poundsToPence(35),
      memberDiscount: poundsToPence(5.25),
      payable: poundsToPence(29.75),
      shipping: 495,
      total: poundsToPence(34.7),
    });
  });

  it("charges no shipping when a discount reduces the payable amount to zero", () => {
    const totals = calculateTotals([line(10)], { isMember: true, memberRate: 1 });
    expect(totals.payable).toBe(0);
    expect(totals.shipping).toBe(0);
  });
});

describe("memberUnitPrice", () => {
  /**
   * The regression this function exists for. The PDP used to compute
   * `Math.round(price * (1 - rate))` over **pounds**, which renders £123 for a
   * £145 product while the bag charges £123.25 — the page and the checkout
   * disagreeing by 25p about the site's own headline member benefit.
   */
  it("keeps the pence a pounds-rounded discount threw away", () => {
    expect(memberUnitPrice(poundsToPence(145))).toBe(poundsToPence(123.25));
    expect(formatPence(memberUnitPrice(poundsToPence(145)))).toBe("£123.25");

    // What the PDP used to render, asserted so the two are visibly different
    // rather than described as different.
    expect(Math.round(145 * 0.85)).toBe(123);
  });

  it("agrees with the cart to the penny for a single unit", () => {
    // The property that matters: whatever the PDP quotes for one, the bag
    // charges for one. Asserted across the catalogue's price range rather than
    // at one convenient value.
    for (const pounds of [4.95, 19, 52, 145, 159.99, 245, 1250]) {
      const unit = poundsToPence(pounds);
      expect(memberUnitPrice(unit)).toBe(
        calculateTotals([{ unitPrice: unit, qty: 1 }], { isMember: true }).payable
      );
    }
  });

  it("honours an overridden rate, as the cart's own option does", () => {
    expect(memberUnitPrice(poundsToPence(145), 0.5)).toBe(poundsToPence(72.5));
    expect(memberUnitPrice(poundsToPence(145), 0)).toBe(poundsToPence(145));
  });

  it("rounds the discount rather than multiplying by its complement", () => {
    // 7 pence at 15% is 1.05p. The cart rounds the *discount* (1p) and
    // subtracts, giving 6. Multiplying by 0.85 gives 5.95 → 6 here too, but the
    // forms diverge in general, and mirroring the cart is what makes them agree
    // by construction. 3p at 50% is the smallest case that shows it: Math.round
    // is half-up, so the discount rounds 1.5 → 2 and leaves 1, while the
    // complement form rounds the same 1.5 the other way and answers 2.
    expect(memberUnitPrice(3, 0.5)).toBe(1);
    expect(Math.round(3 * (1 - 0.5))).toBe(2);
  });

  it("returns whole pence for every rate it is given", () => {
    for (const rate of [0.15, 0.075, 1 / 3, 0.999]) {
      expect(Number.isInteger(memberUnitPrice(14_500, rate))).toBe(true);
    }
  });
});

describe("normaliseQty", () => {
  it.each([
    [0, null],
    [-1, null],
    [1, 1],
    [3, 3],
    [2.7, 2],
    [Number.NaN, null],
  ])("normalises %p to %p", (input, expected) => {
    expect(normaliseQty(input)).toBe(expected);
  });
});
