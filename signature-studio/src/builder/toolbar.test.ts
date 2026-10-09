import { describe, expect, it } from "vitest";
import { toolbarTop } from "./toolbar";

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("block toolbar placement", () => {
  it("goes above by default", () => {
    expect(toolbarTop(r(0, 100, 200, 20), { a: r(0, 100, 200, 20) }, "a")).toBe(60);
  });

  it("goes below when above would hide the block before it", () => {
    const rects = { name: r(0, 60, 200, 30), contacts: r(0, 100, 200, 80) };
    expect(toolbarTop(rects.contacts, rects, "contacts")).toBe(100 + 80 + 12);
  });

  it("ignores the selection's own row and children, and never goes off the top", () => {
    const rects = { row: r(0, 0, 400, 300), sel: r(0, 20, 200, 30), child: r(10, 25, 50, 10) };
    expect(toolbarTop(rects.sel, rects, "sel")).toBe(20 + 30 + 12);
    const roomy = { row: r(0, 0, 400, 300), sel: r(0, 120, 200, 30) };
    expect(toolbarTop(roomy.sel, roomy, "sel")).toBe(80);
  });
});
