import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isActive, pickBanner, safeTarget, type LiveRow } from "./liveBanner";

const at = (s: string) => Date.parse(`${s}T12:00:00Z`);
const row: LiveRow = {
  mode: "schedule",
  fallback: { image: "https://x/fallback.png", link: "https://x" },
  items: [
    { image: "https://x/always.png" },
    { image: "https://x/sale.png", link: "https://x/sale", from: "2026-11-24", to: "2026-11-30" },
    { image: "https://x/new-year.png", from: "2026-12-28", to: "2027-01-02" },
  ],
};

describe("live banners", () => {
  it("shows a dated campaign while it runs, inclusive of both days, then goes back", () => {
    expect(pickBanner(row, at("2026-11-10")).item.image).toBe("https://x/always.png");
    expect(pickBanner(row, at("2026-11-24")).item.image).toBe("https://x/sale.png");
    expect(pickBanner(row, Date.parse("2026-11-30T23:59:00Z")).index).toBe(1);
    expect(pickBanner(row, at("2026-12-01")).index).toBe(0);
    expect(isActive({ image: "", from: "bad" }, at("2026-01-01"))).toBe(true);
  });

  it("falls back when nothing is on", () => {
    const r = { ...row, items: [row.items[1]] };
    expect(pickBanner(r, at("2026-10-01"))).toEqual({ index: -1, item: row.fallback });
  });

  it("rotates daily, and the picture and the click agree within a day", () => {
    const r: LiveRow = { ...row, mode: "rotate", items: [{ image: "a" }, { image: "b" }, { image: "c" }] };
    const seen = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d) => pickBanner(r, at(d)).item.image);
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
    expect(seen[3]).toBe(seen[0]);
    expect(pickBanner(r, Date.parse("2026-10-01T00:01:00Z"))).toEqual(pickBanner(r, Date.parse("2026-10-01T23:59:00Z")));
  });

  it("only redirects to web links", () => {
    expect(safeTarget("https://example.com/x")).toBe("https://example.com/x");
    expect(safeTarget("javascript:alert(1)")).toBeNull();
    expect(safeTarget("not a url")).toBeNull();
  });

  it("the edge function ships the same code", () => {
    const here = readFileSync("src/core/liveBanner.ts", "utf8");
    const there = readFileSync("supabase/functions/banner/pick.ts", "utf8");
    expect(there).toBe(here);
  });
});
