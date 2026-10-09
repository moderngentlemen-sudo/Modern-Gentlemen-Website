/**
 * What the canvas resize handle changes for each kind of block. Dragging the
 * handle scales from the size the block had when the drag started.
 */
import type { Block, SignatureDoc } from "../core/types";

export interface ResizeSpec {
  /** "x": drag sideways scales; "y": drag down grows (spacer). */
  axis: "x" | "y";
  start: number;
  min: number;
  max: number;
  step?: number;
  /** Apply the new value (to the block, or the document for document-level sizes). */
  patch: (v: number) => (doc: SignatureDoc, b: Block) => void;
  label: (v: number) => string;
}

const px = (v: number) => `${Math.round(v)}px`;

export function resizeSpec(b: Block, doc: SignatureDoc, width: number): ResizeSpec | null {
  const d = doc.design;
  const font = (start: number): ResizeSpec => ({
    axis: "x",
    start,
    min: 9,
    max: 40,
    patch: (v) => (_d, x) => void (x.style = { ...x.style, fontSize: Math.round(v) }),
    label: (v) => `${Math.round(v)}px text`,
  });
  switch (b.type) {
    case "photo":
      return {
        axis: "x",
        start: b.size ?? doc.images.photo.size,
        min: 28,
        max: 260,
        patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)),
        label: px,
      };
    case "logo":
      return {
        axis: "x",
        start: b.size ?? doc.images.logo.size,
        min: 28,
        max: 320,
        patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)),
        label: px,
      };
    case "image":
      return { axis: "x", start: b.width, min: 40, max: 640, patch: (v) => (_d, x) => void ((x as typeof b).width = Math.round(v)), label: px };
    case "monogram":
      return { axis: "x", start: b.size, min: 28, max: 140, patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)), label: px };
    case "qr":
      return { axis: "x", start: b.size, min: 48, max: 200, patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)), label: px };
    case "socials":
      return {
        axis: "x",
        start: b.size ?? d.social.size,
        min: 14,
        max: 48,
        patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)),
        label: (v) => `${Math.round(v)}px icons`,
      };
    case "logos":
      return {
        axis: "x",
        start: b.height,
        min: 16,
        max: 120,
        patch: (v) => (_d, x) => void ((x as typeof b).height = Math.round(v)),
        label: (v) => `${Math.round(v)}px tall`,
      };
    case "divider":
      return { axis: "x", start: b.width ?? width, min: 20, max: 640, patch: (v) => (_d, x) => void ((x as typeof b).width = Math.round(v)), label: px };
    case "spacer":
      return {
        axis: "y",
        start: b.height,
        min: 2,
        max: 120,
        patch: (v) => (_d, x) => void ((x as typeof b).height = Math.round(v)),
        label: (v) => `${Math.round(v)}px space`,
      };
    case "name":
      return {
        axis: "x",
        start: b.scale ?? 1,
        min: 0.6,
        max: 3,
        patch: (v) => (_d, x) => void ((x as typeof b).scale = Math.round(v * 100) / 100),
        label: (v) => `${Math.round(d.fontSize * d.nameScale * v)}px name`,
      };
    case "text":
      return { ...font(b.size ?? b.style?.fontSize ?? d.fontSize), patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)) };
    case "canva":
      return { axis: "x", start: doc.card.width, min: 160, max: 700, patch: (v) => (dd) => void (dd.card.width = Math.round(v)), label: px };
    case "title":
    case "field":
    case "contacts":
    case "button":
    case "iconText":
    case "tag":
    case "quote":
    case "reviews":
      return font(b.style?.fontSize ?? d.fontSize);
    default:
      return null;
  }
}
