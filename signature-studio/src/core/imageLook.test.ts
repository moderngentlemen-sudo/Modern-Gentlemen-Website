import { describe, expect, it } from "vitest";
import { applyMatrix, compose, frameLayout, framePath, isPlainLook, lookKey, lookMatrix, paleTint, straightenScale } from "./imageLook";

const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);

describe("image look", () => {
  it("treats untouched looks as plain, and anything baked-in as not", () => {
    expect(isPlainLook(undefined)).toBe(true);
    expect(isPlainLook({ frame: "circle" })).toBe(true);
    expect(isPlainLook({ frame: "squircle" })).toBe(false);
    expect(isPlainLook({ border: 2 })).toBe(false);
    expect(isPlainLook({ preset: "mono" })).toBe(false);
    expect(lookKey({ frame: "circle" }, "#000")).toBe("");
  });

  it("lays out border, ring and shadow around the image", () => {
    const l = frameLayout({ border: 3, gap: 2, shadow: true }, "circle", 100, 100);
    expect(l.m).toBeGreaterThan(0);
    expect(l.W).toBe(100 + l.m * 2);
    expect(l.inner.w).toBe(90);
    expect(l.inner.x).toBe(l.m + 5);
    const r = frameLayout({ inset: 4, radius: 10 }, "rounded", 120, 60);
    expect(r.frame.r).toBe(10);
    expect(r.inner.r).toBe(6);
  });

  it("draws every frame as a closed path", () => {
    for (const s of ["square", "rounded", "circle", "squircle", "arch"] as const) {
      const p = framePath(s, 0, 0, 100, 80, 12);
      expect(p.startsWith("M")).toBe(true);
      expect(p.endsWith("Z")).toBe(true);
    }
  });

  it("composes colour matrices in order and applies them to pixels", () => {
    expect(lookMatrix({}, "#000")).toBeNull();
    const mono = lookMatrix({ preset: "mono" })!;
    const d = px(200, 40, 40);
    applyMatrix(d, mono);
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    // Recolour keeps transparency and paints everything visible one colour.
    const logo = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]);
    applyMatrix(logo, lookMatrix({ preset: "recolor", tone: "#ffffff" })!);
    expect([...logo]).toEqual([255, 255, 255, 255, 255, 255, 255, 0]);
    // Duotone: black → the dark tone, white → the light tone.
    const duo = lookMatrix({ preset: "duotone", tone: "#c8102e", tone2: "#ffffff" })!;
    const bw = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    applyMatrix(bw, duo);
    expect([...bw.slice(0, 3)]).toEqual([200, 16, 46]);
    expect([...bw.slice(4, 7)]).toEqual([255, 255, 255]);
    // Brightness then mono equals mono after brightness.
    const a = lookMatrix({ brightness: 20, preset: "mono" })!;
    const b = compose(lookMatrix({ preset: "mono" })!, lookMatrix({ brightness: 20 })!);
    expect(a.map((v) => v.toFixed(5))).toEqual(b.map((v) => v.toFixed(5)));
  });

  it("finds the zoom that hides a straightened picture's corners", () => {
    expect(straightenScale(100, 100, 0)).toBe(1);
    expect(straightenScale(200, 100, 5)).toBeGreaterThan(1);
    expect(paleTint("#000000")).toBe("#e0e0e0");
  });
});
