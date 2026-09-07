import { describe, it, expect } from "vitest";
import { snapFreeRect } from "./freeSnap";
describe("free canvas snapping", () => {
  it("aligns nearby edges on both axes", () => {
    expect(
      snapFreeRect(
        { x: 103, y: 104, width: 20, height: 20 },
        [{ x: 100, y: 100, width: 80, height: 80 }],
        6
      )
    ).toMatchObject({ x: 100, y: 100, vertical: 100, horizontal: 100 });
  });
  it("aligns centers without mutating measurements", () => {
    const rect = { x: 129, y: 229, width: 20, height: 20 },
      peer = { x: 100, y: 200, width: 80, height: 80 };
    expect(snapFreeRect(rect, [peer], 6)).toMatchObject({
      x: 130,
      y: 230,
      vertical: 140,
      horizontal: 240,
    });
    expect(rect.x).toBe(129);
    expect(peer.x).toBe(100);
  });
  it("snaps to equal spacing between two neighboring elements", () => {
    const result = snapFreeRect(
      { x: 101, y: 0, width: 40, height: 40 },
      [
        { x: 0, y: 0, width: 40, height: 40 },
        { x: 200, y: 0, width: 40, height: 40 },
      ],
      6
    );
    expect(result.x).toBe(100);
    expect(result.gap).toBe(60);
  });
  it("leaves distant elements and unrelated rows alone", () => {
    expect(
      snapFreeRect(
        { x: 100, y: 100, width: 20, height: 20 },
        [{ x: 0, y: 0, width: 30, height: 30 }],
        6
      )
    ).toEqual({ x: 100, y: 100 });
    expect(
      snapFreeRect(
        { x: 101, y: 200, width: 40, height: 40 },
        [
          { x: 0, y: 0, width: 40, height: 40 },
          { x: 200, y: 0, width: 40, height: 40 },
        ],
        6
      ).gap
    ).toBeUndefined();
  });
});
