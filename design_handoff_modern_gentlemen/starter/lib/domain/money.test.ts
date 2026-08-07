import { describe, expect, it } from "vitest";
import { applyRate, formatGBP, formatPence, penceToPounds, poundsToPence } from "./money";
import { formatGBP as catalogFormatGBP } from "@/lib/demo/catalog";

describe("poundsToPence", () => {
  it.each([
    [145, 14_500],
    [4.95, 495],
    [0, 0],
    [0.01, 1],
  ])("converts £%p to %p pence", (pounds, pence) => {
    expect(poundsToPence(pounds)).toBe(pence);
  });

  it("survives binary floating point representation", () => {
    // 145.15 * 100 evaluates to 14514.999999999998 without the rounding step.
    expect(poundsToPence(145.15)).toBe(14_515);
    expect(poundsToPence(1.005)).toBe(101);
  });

  it("rejects non-finite input rather than producing NaN money", () => {
    expect(() => poundsToPence(Number.NaN)).toThrow(RangeError);
    expect(() => poundsToPence(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("penceToPounds", () => {
  it("round-trips through poundsToPence", () => {
    for (const pounds of [0, 4.95, 52, 145, 380.99]) {
      expect(penceToPounds(poundsToPence(pounds))).toBeCloseTo(pounds, 10);
    }
  });

  it("rejects fractional pence, which would mean a lost rounding step", () => {
    expect(() => penceToPounds(10.5)).toThrow(RangeError);
  });
});

describe("applyRate", () => {
  it("rounds to the nearest whole penny", () => {
    expect(applyRate(14_500, 0.15)).toBe(2_175);
    expect(applyRate(343, 0.15)).toBe(51);
  });

  it("rejects fractional pence input", () => {
    expect(() => applyRate(10.5, 0.15)).toThrow(RangeError);
  });
});

describe("formatGBP", () => {
  it("is byte-identical to the existing catalog formatter", () => {
    // The rendered site must not change. This test fails the moment the two
    // implementations diverge.
    for (const value of [0, 4.95, 52, 145, 380, 1250, 21.75]) {
      expect(formatGBP(value)).toBe(catalogFormatGBP(value));
    }
  });

  it("omits decimals for whole pounds and keeps them otherwise", () => {
    expect(formatGBP(145)).toBe("£145");
    expect(formatGBP(4.95)).toBe("£4.95");
  });

  it("groups thousands the way en-GB does", () => {
    expect(formatGBP(1250)).toBe("£1,250");
  });
});

describe("formatPence", () => {
  it("formats canonical pence for display", () => {
    expect(formatPence(14_500)).toBe("£145");
    expect(formatPence(495)).toBe("£4.95");
    expect(formatPence(2_175)).toBe("£21.75");
  });
});
