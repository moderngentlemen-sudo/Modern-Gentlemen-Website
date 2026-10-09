import { describe, expect, it } from "vitest";
import { snapColumn, snapResize } from "./snap";
import { block, col, rowOf } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";

describe("snapping", () => {
  const doc = () => {
    const d = newDoc("corporate-classic", TEMPLATES[0].design);
    d.mode = "builder";
    d.blocks = col([block("photo", { size: 84 }), block("logo", { size: 110 }), block("text", { text: "Hi", size: 13 })]);
    return d;
  };

  it("snaps image sizes to other images and says which", () => {
    const d = doc();
    const photo = d.blocks!.blocks[0].id;
    expect(snapResize(d, photo, 108, "px")).toEqual({ value: 110, match: "Logo" });
    expect(snapResize(d, photo, 100, "px")).toEqual({ value: 100 });
  });

  it("snaps text to the body size", () => {
    const d = doc();
    const t = block("text", { text: "x", size: 15 });
    d.blocks!.blocks.push(t);
    expect(snapResize(d, t.id, d.design.fontSize + 0.4, "font").value).toBe(d.design.fontSize);
  });

  it("snaps columns to even splits and to their neighbours", () => {
    const a = col();
    const b = col([], { width: 180 });
    const root = col([rowOf([a, b])]);
    expect(snapColumn(root, a.id, 247, 500)).toEqual({ value: 250, match: "50%" });
    expect(snapColumn(root, a.id, 183, 500)).toEqual({ value: 180, match: "column 2" });
    expect(snapColumn(root, a.id, 214, 500)).toEqual({ value: 214 });
  });
});
