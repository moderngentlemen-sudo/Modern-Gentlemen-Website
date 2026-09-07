import { describe, it, expect } from "vitest";
import { gestureStyle, alignMove, HANDLES } from "./geometry";
describe("V2 geometry", () => {
  const rect = { x: 0, y: 0, width: 200, height: 100 };
  it("moves without freezing natural dimensions", () => {
    expect(gestureStyle({}, rect, "move", 20, 30)).toEqual({
      position: "relative",
      left: 20,
      top: 30,
    });
  });
  it("resizes every side and corner, keeping the opposite edge stable", () => {
    for (const handle of HANDLES) {
      const s = gestureStyle({}, rect, handle, 20, 10);
      expect(s.widthPx).toBe(handle.includes("w") ? 180 : handle.includes("e") ? 220 : 200);
      expect(s.heightPx).toBe(handle.includes("n") ? 90 : handle.includes("s") ? 110 : 100);
      if (handle.includes("w")) expect(s.left! + s.widthPx!).toBe(200);
      if (handle.includes("n")) expect(s.top! + s.heightPx!).toBe(100);
    }
  });
  it("bounds dimensions and preserves absolute positioning", () => {
    expect(gestureStyle({ position: "absolute" }, rect, "nw", 9999, 9999)).toMatchObject({
      position: "absolute",
      widthPx: 24,
      heightPx: 24,
      left: 176,
      top: 76,
    });
  });
  it("aligns edges and centers without changing input measurements", () => {
    const peer = { x: 203, y: 102, width: 200, height: 100 };
    expect(alignMove(rect, [peer])).toMatchObject({ dx: 3, dy: 2 });
    expect(rect.x).toBe(0);
    expect(alignMove(rect, [{ ...peer, x: 999, y: 999 }])).toEqual({ dx: 0, dy: 0 });
  });
});
