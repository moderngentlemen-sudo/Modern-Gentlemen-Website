import { describe, expect, it } from "vitest";
import { cropPlacement, cropRect } from "./crop";

describe("zooming a picture in its frame", () => {
  it("at 1× and above it is exactly the old crop, filling the frame", () => {
    for (const zoom of [1, 1.5, 3]) {
      const p = cropPlacement(800, 400, 200, 200, { x: 0.3, y: 0, zoom });
      expect(p.src).toEqual(cropRect(800, 400, 1, { x: 0.3, y: 0, zoom }));
      expect(p.dst).toEqual({ x: 0, y: 0, w: 200, h: 200 });
      expect(p.inset).toBe(false);
    }
  });

  it("zoomed out, the whole picture shows smaller inside the frame", () => {
    // A square photo in a square frame at half size: centred, a quarter of the area.
    const p = cropPlacement(400, 400, 100, 100, { x: 0, y: 0, zoom: 0.5 });
    expect(p.src).toEqual({ sx: 0, sy: 0, sw: 400, sh: 400 });
    expect(p.dst).toEqual({ x: 25, y: 25, w: 50, h: 50 });
    expect(p.inset).toBe(true);
    // Pan moves it within the free space: −1 hugs the far edge, like dragging.
    expect(cropPlacement(400, 400, 100, 100, { x: -1, y: 1, zoom: 0.5 }).dst).toEqual({ x: 50, y: 0, w: 50, h: 50 });
  });

  it("a wide logo zoomed out a little still crops sideways but gains room top and bottom", () => {
    // 600×200 logo in a square frame: covering needs 3× its width; at 0.5 it is 1.5 frames wide.
    const p = cropPlacement(600, 200, 100, 100, { x: 0, y: 0, zoom: 0.5 });
    expect(p.dst.w).toBe(100);
    expect(p.src.sw).toBeCloseTo(400);
    expect(p.dst.h).toBeCloseTo(50);
    expect(p.dst.y).toBeCloseTo(25);
  });

  it("never shrinks past the minimum", () => {
    expect(cropPlacement(100, 100, 100, 100, { x: 0, y: 0, zoom: 0.01 }).dst.w).toBe(25);
  });
});
