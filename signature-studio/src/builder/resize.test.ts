import { describe, expect, it } from "vitest";
import { handlesFor, resizeValue, type ResizeSpec } from "./resize";

const spec = (axis: "x" | "y", start = 100): ResizeSpec => ({ axis, start, min: 10, max: 400, patch: () => () => undefined, label: String });
const box = { w: 100, h: 50 };

describe("resize handles in every direction", () => {
  it("grows when dragged away from the block, from any edge", () => {
    expect(resizeValue(spec("x"), "e", 50, 0, box)).toBe(150);
    expect(resizeValue(spec("x"), "w", -50, 0, box)).toBe(150);
    expect(resizeValue(spec("x"), "s", 0, 25, box)).toBe(150);
    expect(resizeValue(spec("x"), "n", 0, -25, box)).toBe(150);
  });

  it("shrinks when dragged towards it, and stays within limits", () => {
    expect(resizeValue(spec("x"), "w", 50, 0, box)).toBe(50);
    expect(resizeValue(spec("x"), "n", 0, 49, box)).toBe(10);
    expect(resizeValue(spec("x"), "e", 1000, 0, box)).toBe(400);
  });

  it("corners follow the bigger movement", () => {
    expect(resizeValue(spec("x"), "se", 10, 25, box)).toBe(150);
    expect(resizeValue(spec("x"), "nw", -60, -5, box)).toBe(160);
    expect(resizeValue(spec("x"), "ne", 20, 0, box)).toBe(120);
  });

  it("spacers only grow up or down", () => {
    expect(handlesFor(spec("y"))).toEqual(["n", "s"]);
    expect(handlesFor(spec("x"))).toHaveLength(8);
    // A short block (a one-line name) keeps its corners and top/bottom, not side edges that would cover the corners.
    expect(handlesFor(spec("x"), { w: 200, h: 24 })).toEqual(["nw", "n", "ne", "se", "s", "sw"]);
    expect(resizeValue(spec("y", 20), "s", 0, 30, box)).toBe(50);
    expect(resizeValue(spec("y", 20), "n", 0, -30, box)).toBe(50);
  });
});
