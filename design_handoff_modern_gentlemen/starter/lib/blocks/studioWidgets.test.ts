import { describe, expect, it } from "vitest";
import { countdownParts, countdownUnits, normalizeStudioWidget } from "./studioWidgets";

describe("Studio countdown", () => {
  it("uses actual calendar months, including month-end clamping", () => {
    expect(
      countdownParts("2028-02-29T12:00:00Z", Date.parse("2028-01-31T12:00:00Z"), "months")
    ).toMatchObject({ months: 1, weeks: 0, days: 0, hours: 0, expired: false });
    expect(
      countdownParts("2028-02-28T12:00:00Z", Date.parse("2028-01-31T12:00:00Z"), "months")
    ).toMatchObject({ months: 0, weeks: 4, days: 0 });
  });
  it("splits weeks and preserves the selected units", () => {
    expect(
      countdownParts("2030-01-10T01:02:03Z", Date.parse("2030-01-01T00:00:00Z"), "weeks")
    ).toMatchObject({ weeks: 1, days: 2, hours: 1, minutes: 2, seconds: 3 });
    expect(countdownUnits({ unitMode: "months", showSeconds: false })).toEqual([
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
    ]);
  });
  it("rejects dates without a timezone and unsupported typography", () => {
    expect(
      normalizeStudioWidget("countdown", { target: "2030-01-01T00:00" }).issues.length
    ).toBeGreaterThan(0);
    expect(
      normalizeStudioWidget("countdown", {
        target: "2030-01-01T00:00:00Z",
        numberStyle: { font: "Unregistered font" },
      }).issues.length
    ).toBeGreaterThan(0);
    expect(
      normalizeStudioWidget("countdown", {
        target: "2030-01-01T00:00:00Z",
        labelStyle: { color: "url(https://example.com)" },
      }).issues.length
    ).toBeGreaterThan(0);
  });
});
