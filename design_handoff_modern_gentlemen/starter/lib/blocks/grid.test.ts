import { describe, it, expect } from "vitest";
import { gridPlacement, gridPlacementSchema, gridPosition, shiftGrid } from "./grid";
import { validateVisualDesign } from "./visual";
import { validateTree } from "./validate";
import { createBuilderStore } from "@/components/admin/builder/store";
import { newBlockNode } from "@/components/admin/builder/node";
const desktop = { column: 2, row: 3, span: 5, rows: 2 };
function store() {
  const grid = newBlockNode("gridLayout");
  return createBuilderStore({
    doc: {
      type: "page",
      id: "p",
      title: "Grid",
      slug: "grid",
      status: "draft",
      version: 1,
      treeKey: "sections",
      rest: {},
    },
    tree: [grid],
  });
}
describe("grid placement", () => {
  it("rejects out-of-bounds, fractional and unknown CSS values", () => {
    for (const bad of [
      { ...desktop, span: 12 },
      { ...desktop, row: 1.5 },
      { ...desktop, column: NaN },
      { ...desktop, css: "display:none" },
    ])
      expect(gridPlacementSchema.safeParse(bad).success).toBe(false);
    expect(validateVisualDesign({ grid: { mobile: { ...desktop, row: 101 } } })).not.toHaveLength(
      0
    );
  });
  it("defaults to a phone-safe full width without copying desktop positions", () => {
    expect(gridPlacement({ desktop }, "mobile")).toEqual({ column: 0, row: 0, span: 12, rows: 1 });
    expect(gridPosition(desktop)).toMatchObject({
      gridColumn: "2 / span 5",
      gridRow: "3 / span 2",
    });
  });
  it("clamps moving and resizing at all canvas edges", () => {
    expect(shiftGrid(desktop, 100, -100, false)).toEqual({ ...desktop, column: 8, row: 1 });
    expect(shiftGrid(desktop, 100, 100, true)).toEqual({ ...desktop, span: 11, rows: 40 });
    expect(shiftGrid(desktop, -100, -100, true)).toEqual({ ...desktop, span: 1, rows: 1 });
  });
  it("persists only the edited device and restores a whole gesture with undo/redo", () => {
    const s = store();
    const key = s.getState().tree[0].children![0]._key;
    const before = s.getState().tree;
    s.getState().setGridPlacement(key, "desktop", desktop);
    expect(s.getState().past).toHaveLength(1);
    expect(s.getState().tree[0].children![0].visual?.grid).toEqual({ desktop });
    expect(validateTree(s.getState().tree).issues).toEqual([]);
    s.getState().undo();
    expect(s.getState().tree).toEqual(before);
    s.getState().redo();
    expect(s.getState().tree[0].children![0].visual?.grid?.desktop).toEqual(desktop);
  });
  it("ignores invalid and locked writes and preserves placements when duplicating", () => {
    const s = store(),
      key = s.getState().tree[0].children![0]._key;
    s.getState().setGridPlacement(key, "mobile", desktop);
    s.getState().duplicate(key);
    expect(s.getState().tree[0].children![1].visual?.grid?.mobile).toEqual(desktop);
    s.getState().setLocked(key, true);
    const before = s.getState().tree;
    s.getState().setGridPlacement(key, "desktop", desktop);
    expect(s.getState().tree).toBe(before);
    s.getState().setGridPlacement(s.getState().tree[0].children![1]._key, "desktop", {
      ...desktop,
      span: 99,
    });
    expect(s.getState().tree).toBe(before);
  });
});
