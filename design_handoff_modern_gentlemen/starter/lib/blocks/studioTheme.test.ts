import { describe, expect, it } from "vitest";
import {
  studioAdaptiveSurface,
  studioAdaptiveGradient,
  studioThemeGradient,
  studioDarkColor,
  studioFixedFill,
  studioThemeColor,
  studioThemeInk,
} from "./studioTheme";

describe("Studio theme palette", () => {
  it("darkens custom surfaces and lifts custom ink with hue and opacity retained", () => {
    expect(studioDarkColor("#e3f1ff80", "surface")).toBe("#20222480");
    expect(studioThemeColor("#e3f1ff")).toContain("var(--studio-dark-weight, 0%)");
    expect(studioThemeInk("#432486")).toContain("var(--studio-dark-weight, 0%)");
    expect(studioDarkColor("#1230", "ink")).toMatch(/^#[a-f0-9]{6}00$/);
    const lum = (color: string) => {
      const values = [1, 3, 5]
        .map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    for (const color of ["#0000ff", "#ff0000", "#004477", "#432486", "#777777", "#aabbcc"])
      expect(
        (lum(studioDarkColor(color, "ink")!) + 0.05) / (lum("#2e2e2e") + 0.05)
      ).toBeGreaterThan(4.5);
  });
  it("retains gradient direction, stop positions and alpha without accepting arbitrary CSS", () => {
    const gradient = "linear-gradient(35deg,#e3f1ff80 0%,#f2d9ee 65%,#102030 100%)";
    expect(studioAdaptiveGradient(gradient)).toBe(true);
    expect(studioThemeGradient(gradient)).toContain("linear-gradient(35deg,");
    expect(studioThemeGradient(gradient)).toContain("#20222480");
    expect(studioThemeGradient(gradient)).toContain(" 65%,");
    expect(studioAdaptiveGradient("linear-gradient(90deg,#101010,#203040)")).toBe(false);
    expect(studioThemeGradient("url(https://example.com)")).toBeUndefined();
  });
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
    for (const value of ["#c8102e", "transparent", "#ffffff00"])
      expect(studioThemeColor(value)).toBe(value);
    expect(studioThemeColor("url(https://example.com)")).toBeUndefined();
  });
  it("adapts light and translucent surfaces while keeping dark compositions fixed", () => {
    for (const value of ["#FFF", "#f4f4f4ff", "#ffffff80", "transparent", "#e3f1ff"])
      expect(studioAdaptiveSurface(value)).toBe(true);
    for (const value of ["#0d0d0d", "#c8102e", undefined])
      expect(studioAdaptiveSurface(value)).toBe(false);
    expect(studioFixedFill("#c8102e")).toBe(true);
    expect(studioFixedFill("#c8102e00")).toBe(false);
    expect(studioFixedFill("#141414")).toBe(false);
  });
});
