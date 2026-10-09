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

/** The eight handles around a selected block: corners and edges. */
export type HandleDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const HANDLE_DIRS: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Below this frame size (px on screen) an edge handle would sit on top of the corners. */
const EDGE_ROOM = 48;

/**
 * Handles that make sense for a spec and frame: a spacer only grows up or
 * down, and a short or narrow block drops the edge handles that would
 * overlap its corners.
 */
export function handlesFor(spec: ResizeSpec, frame: { w: number; h: number } = { w: Infinity, h: Infinity }): HandleDir[] {
  if (spec.axis === "y") return ["n", "s"];
  return HANDLE_DIRS.filter((d) => {
    if (d === "e" || d === "w") return frame.h >= EDGE_ROOM;
    if (d === "n" || d === "s") return frame.w >= EDGE_ROOM;
    return true;
  });
}

/**
 * The new value when a handle moves by (dx, dy) screen px (already divided by
 * zoom). Blocks keep their proportions, so every handle scales the whole block:
 * dragging away from the block's centre grows it, towards it shrinks it. A
 * corner follows whichever direction moved further.
 */
export function resizeValue(spec: ResizeSpec, dir: HandleDir, dx: number, dy: number, box: { w: number; h: number }): number {
  const clamp = (v: number) => Math.min(spec.max, Math.max(spec.min, v));
  const sx = dir.includes("e") ? 1 : dir.includes("w") ? -1 : 0;
  const sy = dir.includes("s") ? 1 : dir.includes("n") ? -1 : 0;
  if (spec.axis === "y") return clamp(spec.start + sy * dy);
  const w = Math.max(8, box.w);
  const h = Math.max(8, box.h);
  const fx = sx ? (w + sx * dx) / w : 1;
  const fy = sy ? (h + sy * dy) / h : 1;
  const f = Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;
  return clamp(spec.start * Math.max(0.05, f));
}

export const HANDLE_CURSOR: Record<HandleDir, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};
