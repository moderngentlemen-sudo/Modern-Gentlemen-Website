import { describe, expect, it } from "vitest";
import { makeSlug, SLUG_RE, slugFromPath } from "./cardSlug";

describe("card short links", () => {
  it("makes readable, valid slugs from any name", () => {
    expect(makeSlug("Jordan Ellis", () => 0)).toBe("jordan-ellis-aaaa");
    expect(makeSlug("Zoë O'Brien-Šimić", () => 0)).toBe("zoe-o-brien-simic-aaaa");
    for (const n of ["", "ليلى حداد", "!!!", "A".repeat(80)]) expect(SLUG_RE.test(makeSlug(n))).toBe(true);
  });

  it("reads only well-formed /c/ paths", () => {
    expect(slugFromPath("/c/jordan-ellis-k3f9")).toBe("jordan-ellis-k3f9");
    expect(slugFromPath("/c/Bad_Slug")).toBeNull();
    expect(slugFromPath("/app")).toBeNull();
  });
});
