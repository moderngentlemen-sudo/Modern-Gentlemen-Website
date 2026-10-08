import { describe, expect, it } from "vitest";

import {
  boundStage,
  dragStage,
  nudgeStage,
  responsiveStageSchema,
  snapStage,
  stagePlacement,
  stageVariables,
} from "./stage";

const p = { x: 10, y: 20, w: 40, scale: 1, z: 2 };

describe("stage placement", () => {
  it("falls back tablet → desktop, and stacks phones unless free", () => {
    expect(stagePlacement({ desktop: p }, "tablet")).toEqual(p);
    expect(stagePlacement({ desktop: p }, "mobile")).toBeNull();
    expect(stagePlacement({ desktop: p }, "mobile", { mobileFree: true })).toEqual(p);
    const tablet = { ...p, x: 50 };
    expect(stagePlacement({ desktop: p, tablet }, "mobile", { mobileFree: true })).toEqual(tablet);
  });

  it("gives unplaced elements a visible, cascaded default", () => {
    const a = stagePlacement(undefined, "desktop", { index: 0 })!;
    const b = stagePlacement(undefined, "desktop", { index: 1 })!;
    expect(a.w).toBeGreaterThan(0);
    expect([a.x, a.y]).not.toEqual([b.x, b.y]);
  });

  it("ignores invalid stored data rather than rendering it", () => {
    expect(stagePlacement({ desktop: { ...p, scale: 99 } }, "desktop", { index: 0 })!.scale).toBe(
      1
    );
    expect(responsiveStageSchema.safeParse({ desktop: { ...p, extra: 1 } }).success).toBe(false);
  });

  it("emits percentage and number variables only", () => {
    const vars = stageVariables({ desktop: { ...p, scale: 1.5 } });
    expect(vars["--sd-x"]).toBe("10%");
    expect(vars["--sd-w"]).toBe("60%");
    expect(vars["--sd-s"]).toBe(1.5);
    expect(Object.values(vars).every((v) => typeof v === "number" || /^-?[\d.]+%$/.test(v))).toBe(
      true
    );
  });

  it("clamps and rounds", () => {
    expect(boundStage({ x: 999, y: -999, w: 0, scale: 0.01, z: 99.6 })).toEqual({
      x: 150,
      y: -50,
      w: 2,
      scale: 0.1,
      z: 50,
    });
  });
});

describe("dragging on the stage", () => {
  it("moves without resizing", () => {
    expect(dragStage(p, "move", 5, -5)).toEqual({ ...p, x: 15, y: 15 });
  });

  it("scales proportionally from a corner, keeping the opposite corner still", () => {
    const se = dragStage(p, "se", 20, 0);
    expect(se.scale).toBeCloseTo(1.5);
    expect(se.x).toBe(10);
    const nw = dragStage(p, "nw", -20, 0, 10);
    expect(nw.scale).toBeCloseTo(1.5);
    expect(nw.x + nw.w * nw.scale).toBeCloseTo(p.x + p.w);
    expect(nw.y).toBeCloseTo(15);
  });

  it("changes the wrap width from the sides", () => {
    expect(dragStage(p, "e", 10, 0).w).toBe(50);
    const w = dragStage(p, "w", -10, 0);
    expect(w.w).toBe(50);
    expect(w.x).toBe(0);
  });

  it("nudges by half a percent, or five with Shift", () => {
    expect(nudgeStage(p, 1, 0)).toMatchObject({ x: 10.5 });
    expect(nudgeStage(p, 0, -1, true)).toMatchObject({ y: 15 });
  });

  it("snaps to the stage centre and to peers", () => {
    const centre = snapStage({ x: 30.6, y: 10, w: 40, h: 10 }, []);
    expect(centre.x).toBeCloseTo(30);
    expect(centre.vertical).toBe(50);
    const peer = snapStage({ x: 61, y: 40, w: 10, h: 5 }, [{ x: 10, y: 0, w: 50, h: 20 }], 1.5);
    expect(peer.x).toBe(60);
  });
});
