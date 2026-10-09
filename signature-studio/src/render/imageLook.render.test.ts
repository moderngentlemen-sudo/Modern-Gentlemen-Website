import { describe, expect, it } from "vitest";
import { renderSignature } from "./render";
import { validateEmailHtml } from "./validate";
import { TEMPLATES } from "../core/templates";
import { newDoc, SAMPLE_DETAILS } from "../core/defaults";
import { applyTemplate } from "../core/apply";
import { scaleDoc } from "../core/scale";
import { imageSharpness, runChecks } from "../core/checks";
import type { SignatureDoc } from "../core/types";

function doc(): SignatureDoc {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  applyTemplate(d, TEMPLATES[0].id);
  d.details = { ...SAMPLE_DETAILS, custom: [] };
  d.assets.p = { id: "p", name: "p.jpg", mime: "image/jpeg", width: 800, height: 800, bytes: 1, hash: "hp" };
  d.images.photo.assetId = "p";
  d.images.photo.size = 80;
  return d;
}

const crop = (d: SignatureDoc) =>
  renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" }).images.find((r) => r.kind === "crop")!;

describe("framed images", () => {
  it("a plain photo keeps its old request, so nothing already published changes", () => {
    const r = crop(doc());
    expect(r.kind === "crop" && r.look).toBeFalsy();
    expect(r.key).toMatch(/\|circle$|\|square$|\|rounded$/);
  });

  it("frame, border and shadow become one baked image, larger by the shadow margin", () => {
    const d = doc();
    d.images.photo.look = { frame: "squircle", border: 3, borderColor: "#c8102e", shadow: true };
    const r = crop(d);
    if (r.kind !== "crop") throw new Error("expected a crop");
    expect(r.look?.frame).toBe("squircle");
    expect(r.w).toBeGreaterThan(80);
    expect(r.w).toBe(r.h);
    const email = renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" });
    expect(email.html).toContain(`width="${r.w}"`);
    expect(validateEmailHtml(email.html).filter((p) => p.level === "error")).toEqual([]);
    // The editor shows the same geometry as SVG.
    const preview = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x" });
    expect(preview.html).toContain("<svg");
    expect(preview.html).toContain("clipPath");
    expect(preview.html).toContain("feDropShadow");
  });

  it("colour presets change the published image's key and show as a colour matrix while editing", () => {
    const d = doc();
    const before = crop(d).key;
    d.images.photo.look = { preset: "duotone" };
    expect(crop(d).key).not.toBe(before);
    d.design.accent = "#0a66c2";
    const k1 = crop(d).key;
    d.design.accent = "#c8102e";
    expect(crop(d).key).not.toBe(k1);
    expect(renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x" }).html).toContain("feColorMatrix");
  });

  it("borders and padding scale with the whole signature", () => {
    const d = doc();
    d.images.photo.look = { border: 4, inset: 6 };
    const s = scaleDoc(d, 1.5);
    expect(s.images.photo.look?.border).toBe(6);
    expect(s.images.photo.look?.inset).toBe(9);
  });
});

describe("image checks", () => {
  it("rates sharpness against the 2× publish size", () => {
    expect(imageSharpness(100, 120)).toBe("blurry");
    expect(imageSharpness(150, 100)).toBe("soft");
    expect(imageSharpness(200, 100)).toBeNull();
  });

  it("flags a photo that is too small for its size", () => {
    const d = doc();
    d.assets.p = { ...d.assets.p, width: 60, height: 60 };
    expect(runChecks(d).some((i) => i.id.startsWith("blurry-") && i.message.startsWith("Your photo"))).toBe(true);
    d.assets.p = { ...d.assets.p, width: 800, height: 800 };
    expect(runChecks(d).some((i) => i.id.startsWith("blurry-") || i.id.startsWith("soft-"))).toBe(false);
  });
});
