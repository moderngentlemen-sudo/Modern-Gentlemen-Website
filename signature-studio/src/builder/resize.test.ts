import { describe, expect, it } from "vitest";
import { handlesFor, resizeSpec, resizeValue, stepValue, type ResizeSpec } from "./resize";
import { block } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";

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
    // A 40px-tall logo keeps its side handles when there is room for compact ones.
    expect(handlesFor(spec("x"), { w: 120, h: 40 }, 30)).toHaveLength(8);
    expect(handlesFor(spec("x"), { w: 120, h: 40 })).toHaveLength(6);
    expect(resizeValue(spec("y", 20), "s", 0, 30, box)).toBe(50);
    expect(resizeValue(spec("y", 20), "n", 0, -30, box)).toBe(50);
  });
});

describe("precise scaling", () => {
  const doc = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  doc.assets.a = { id: "a", name: "a.png", mime: "image/png", width: 600, height: 200, bytes: 1, hash: "h" };

  it("text corners follow the height, so a long line still scales sensibly", () => {
    const t = resizeSpec(block("text", { text: "A long line of text" }), doc, 400)!;
    expect(t.prefer).toBe("y");
    expect(resizeValue(t, "se", 40, 6, { w: 400, h: 18 })).toBeCloseTo((t.start * 24) / 18);
  });

  it("image side edges unlock the aspect; corners keep it", () => {
    const img = block("image", { assetId: "a", width: 300 });
    const s = resizeSpec(img, doc, 300)!;
    expect(s.dims).toBe("300 × 100");
    const r = s.stretch!("e", 60, 0, { w: 999, h: 999 });
    expect(r.label).toBe("360 × 100");
    r.patch(doc, img);
    expect(img.type === "image" && img.width).toBe(360);
    expect(img.type === "image" && img.aspect).toBe(3.6);
    const h = s.stretch!("s", 0, 50, { w: 300, h: 100 });
    expect(h.label).toBe("300 × 150");
  });

  it("logo and photo edges reshape too; a circular photo keeps its proportions", () => {
    const d = structuredClone(doc);
    d.images.logo.assetId = "a";
    d.images.logo.size = 120;
    const logo = block("logo");
    const s = resizeSpec(logo, d, 120)!;
    expect(s.dims).toBe("120 × 40");
    const r = s.stretch!("e", 30, 0, { w: 999, h: 999 });
    expect(r.label).toBe("150 × 40");
    r.patch(d, logo);
    expect(logo.type === "logo" && logo.size).toBe(150);
    expect(d.images.logo.aspect).toBe(3.75);
    expect(s.stretch!("s", 0, 20, { w: 0, h: 0 }).label).toBe("120 × 60");

    d.images.photo.assetId = "a";
    d.images.photo.size = 84;
    d.images.photo.shape = "circle";
    expect(resizeSpec(block("photo"), d, 84)!.stretch).toBeUndefined();
    d.images.photo.shape = "rounded";
    const p = resizeSpec(block("photo"), d, 84)!;
    expect(p.dims).toBe("84 × 84");
    expect(p.stretch!("n", 0, -16, { w: 0, h: 0 }).label).toBe("84 × 100");
    // At 1.5× whole-signature scale, 30 screen pixels are 20 stored ones.
    d.design.scale = 1.5;
    expect(resizeSpec(logo, d, 150)!.stretch!("e", 30, 0, { w: 0, h: 0 }).label).toBe("170 × 40");
  });

  it("steps by one, or ten with Shift, within limits", () => {
    const s = resizeSpec(block("photo"), doc, 84)!;
    expect(stepValue(s, 1)).toBe(s.start + 1);
    expect(stepValue(s, -1, true)).toBe(s.start - 10);
    expect(stepValue({ ...s, start: s.max }, 1)).toBe(s.max);
    const name = resizeSpec(block("name"), doc, 200)!;
    expect(stepValue(name, 1)).toBeCloseTo(1.05);
  });
});

describe("edge handles on every block reshape it rather than scale it", () => {
  const doc = () => {
    const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    d.socials = [
      { platform: "linkedin", url: "linkedin.com/in/x" },
      { platform: "x", url: "x.com/x" },
      { platform: "instagram", url: "instagram.com/x" },
    ] as typeof d.socials;
    return d;
  };
  const tall = { w: 200, h: 60 };

  it("text blocks: side edges set the text box width; no top or bottom edges; corners still scale the text", () => {
    for (const type of ["name", "title", "text", "quote", "reviews", "tag", "iconText", "signOff"] as const) {
      const b = block(type);
      const s = resizeSpec(b, doc(), 300)!;
      expect(handlesFor(s, tall), type).toEqual(["nw", "ne", "e", "se", "sw", "w"]);
      const x = structuredClone(b);
      const r = s.stretch!("e", 40, 0, { w: 200, h: 20 });
      r.patch(doc(), x);
      expect(x.style?.width, type).toBe(240);
      expect(r.label).toBe("240px wide");
    }
    // A single line of text still gets its side handles.
    expect(handlesFor(resizeSpec(block("title"), doc(), 300)!, { w: 200, h: 18 }, 30)).toContain("e");
  });

  it("buttons: sides set the width, top and bottom the height", () => {
    const b = block("button");
    const s = resizeSpec(b, doc(), 300)!;
    expect(handlesFor(s, tall)).toHaveLength(8);
    const x = structuredClone(b);
    s.stretch!("w", -30, 0, { w: 120, h: 34 }).patch(doc(), x);
    expect(x.type === "button" && x.width).toBe(150);
    const r = s.stretch!("s", 0, 10, { w: 120, h: 34 });
    r.patch(doc(), x);
    expect(x.type === "button" && x.padY).toBe(13);
    expect(r.label).toBe("44px tall");
  });

  it("social icons: side edges spread them apart; square blocks only get corners", () => {
    const b = block("socials");
    const s = resizeSpec(b, doc(), 300)!;
    expect(handlesFor(s, tall)).toEqual(["nw", "ne", "e", "se", "sw", "w"]);
    const x = structuredClone(b);
    s.stretch!("e", 20, 0, tall).patch(doc(), x);
    expect(x.type === "socials" && x.gap).toBe(doc().design.social.gap + 10);
    for (const type of ["qr", "monogram", "apps"] as const)
      expect(handlesFor(resizeSpec(block(type), doc(), 300)!, tall), type).toEqual(["nw", "ne", "se", "sw"]);
  });
});
