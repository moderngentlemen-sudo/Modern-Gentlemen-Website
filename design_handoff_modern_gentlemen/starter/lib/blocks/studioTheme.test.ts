import { describe, expect, it } from "vitest";
import {
  studioAdaptiveSurface,
  studioFixedFill,
  studioThemeColor,
  studioThemeInk,
} from "./studioTheme";

describe("Studio theme palette", () => {
  it("recognizes the cream, beige and warm ink used by the native templates", () => {
    for (const color of ["#f8f7f3", "#dfd9ce"]) {
      expect(studioAdaptiveSurface(color)).toBe(true);
      expect(studioFixedFill(color)).toBe(false);
    }
    for (const color of ["#f8f7f3", "#dfd9ce", "#645f56", "#8b857b"])
      expect(studioThemeColor(color)).toBe(`var(--studio-${color.slice(1)}, ${color})`);
    expect(studioThemeInk("#c8102e")).toBe("var(--studio-accent-ink, #c8102e)");
    expect(studioThemeColor("#c8102e")).toBe("#c8102e");
    expect(studioFixedFill("#c8102e")).toBe(true);
  });
  it("adapts standard neutrals including shorthand and translucent borders", () => {
    expect(studioThemeColor("#FFF")).toBe("var(--studio-ffffff, #ffffff)");
    expect(studioThemeColor("#14141455")).toBe(
      "color-mix(in srgb, var(--studio-141414, #141414) 33.33333333333333%, transparent)"
    );
    expect(studioThemeColor("#ffff")).toBe(studioThemeColor("#ffffff"));
  });
  it("preserves authored colors and transparency, rejecting unsafe CSS", () => {
    for (const value of ["#c8102e", "#e8e2d6", "transparent", "#ffffff00"])
      expect(studioThemeColor(value)).toBe(value);
    expect(studioThemeColor("url(https://example.com)")).toBeUndefined();
  });
  it("adapts opaque light surfaces while keeping dark or custom compositions fixed", () => {
    for (const value of ["#FFF", "#f4f4f4ff"]) expect(studioAdaptiveSurface(value)).toBe(true);
    for (const value of ["#0d0d0d", "#c8102e", "#ffffff80", undefined])
      expect(studioAdaptiveSurface(value)).toBe(false);
    expect(studioFixedFill("#c8102e")).toBe(true);
    expect(studioFixedFill("#c8102e00")).toBe(false);
    expect(studioFixedFill("#141414")).toBe(false);
  });
});
