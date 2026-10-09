import { describe, expect, it } from "vitest";
import { applyMask, keyOutBackground, orientMask } from "./cutout";

/** w×h white image with a dark square in the middle and a white dot inside it. */
function logo(w = 20, h = 10) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 3; y < 7; y++)
    for (let x = 6; x < 14; x++) {
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 20;
    }
  const dot = (5 * w + 10) * 4;
  d[dot] = d[dot + 1] = d[dot + 2] = 255;
  return d;
}
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("background removal", () => {
  it("clears a flat background connected to the edges and keeps the artwork", () => {
    const d = logo();
    const cleared = keyOutBackground(d, 20, 10);
    expect(cleared).toBe(200 - 32);
    expect(alpha(d, 20, 0, 0)).toBe(0);
    expect(alpha(d, 20, 8, 4)).toBe(255);
    // White inside the artwork isn't connected to the background, so it stays.
    expect(alpha(d, 20, 10, 5)).toBe(255);
  });

  it("feathers pixels that are close to the background colour", () => {
    const d = new Uint8ClampedArray(3 * 1 * 4).fill(255);
    d[4] = d[5] = d[6] = 210; // 45 away: between tolerance and twice it
    keyOutBackground(d, 3, 1, 28);
    expect(alpha(d, 3, 1, 0)).toBeGreaterThan(0);
    expect(alpha(d, 3, 1, 0)).toBeLessThan(255);
  });

  it("orients a mask so the middle is kept, then applies it", () => {
    const w = 10;
    const h = 10;
    const inverted = new Float32Array(w * h).fill(1);
    for (let y = 3; y < 8; y++) for (let x = 3; x < 7; x++) inverted[y * w + x] = 0;
    const m = orientMask(inverted, w, h);
    expect(m[5 * w + 5]).toBe(1);
    expect(m[0]).toBe(0);
    const d = new Uint8ClampedArray(w * h * 4).fill(255);
    applyMask(d, m);
    expect(alpha(d, w, 5, 5)).toBe(255);
    expect(alpha(d, w, 0, 0)).toBe(0);
  });
});
