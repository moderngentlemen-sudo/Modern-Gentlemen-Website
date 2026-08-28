import { describe, expect, it } from "vitest";

import { retryAfterMs } from "./http";

/**
 * `Retry-After`, which arrives from a server nobody here controls.
 *
 * ⚠️ Every case below that returns `null` is protecting the same thing: a wait
 * of `NaN` milliseconds. `setTimeout(fn, NaN)` fires on the next tick, so a
 * malformed header would not slow the retry down — it would turn the backoff
 * into a hot loop against a provider that is already refusing requests, which is
 * worse than not retrying at all. Falling back to a known delay is the only safe
 * reading of a header that cannot be read.
 */
describe("retryAfterMs", () => {
  it("reads the delta-seconds form, including the decimal Shopify sends", () => {
    expect(retryAfterMs("2.0")).toBe(2_000);
    expect(retryAfterMs("30")).toBe(30_000);
    expect(retryAfterMs("  2.5  ")).toBe(2_500);
    expect(retryAfterMs("0")).toBe(0);
  });

  it("reads the HTTP-date form, relative to now", () => {
    const now = Date.parse("2026-08-28T06:00:00Z");
    expect(retryAfterMs("Fri, 28 Aug 2026 06:00:30 GMT", now)).toBe(30_000);
  });

  it("clamps a date already in the past to zero rather than a negative wait", () => {
    const now = Date.parse("2026-08-28T06:00:00Z");
    expect(retryAfterMs("Fri, 28 Aug 2026 05:59:00 GMT", now)).toBe(0);
  });

  it("returns null for anything it cannot read", () => {
    for (const header of [null, "", "   ", "soon", "-5", "2 seconds", "Fri, 32 Aug 2026"]) {
      expect(retryAfterMs(header), String(header)).toBeNull();
    }
  });
});
