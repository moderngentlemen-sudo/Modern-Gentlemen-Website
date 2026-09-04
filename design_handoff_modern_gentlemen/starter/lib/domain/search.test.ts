import { describe, expect, it } from "vitest";

import { matchesSearchQuery, searchWords } from "./search";

describe("searchWords", () => {
  it("treats punctuation as separators and retains international letters", () => {
    expect(searchWords("  Slow-car, café 42! ")).toEqual(["slow", "car", "café", "42"]);
  });
});

describe("matchesSearchQuery", () => {
  const copy = [
    "The Slow Car, Fast Philosophy",
    "Why less speed can mean more pleasure",
    "the-slow-car-fast-philosophy",
  ];

  it("matches every word across separate fields and intervening copy", () => {
    expect(matchesSearchQuery(copy, "slow philosophy")).toBe(true);
    expect(matchesSearchQuery(copy, "more car")).toBe(true);
  });

  it("does not turn punctuation-only or partial queries into match-all", () => {
    expect(matchesSearchQuery(copy, "---")).toBe(false);
    expect(matchesSearchQuery(copy, "slow shaving")).toBe(false);
  });
});
