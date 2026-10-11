/**
 * What the canvas resize handle changes for each kind of block. Dragging the
 * handle scales from the size the block had when the drag started.
 */
import type { Block, SignatureDoc } from "../core/types";
import { clampScale } from "../core/scale";
import { colGapOf, hasColGap, hasRowGap, MAX_COL_GAP, MAX_ROW_GAP, rowGapOf } from "../core/contactLayout";

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
  /** Corners follow the vertical movement (text: a long line barely changes width ratio). */
  prefer?: "y";
  /** Edge handles change the shape instead of scaling (images: unlock the aspect). */
  stretch?: (dir: HandleDir, dx: number, dy: number, box: { w: number; h: number }) => { patch: (doc: SignatureDoc, b: Block) => void; label: string };
  /** One-click sizes. */
  presets?: { label: string; value: number }[];
  /** "W × H" for blocks whose shape can change. */
  dims?: string;
  /** Which edge handles to offer (default both). Contacts: a list has no side-by-side gap to drag. */
  edges?: { x: boolean; y: boolean };
}

const px = (v: number) => `${Math.round(v)}px`;

/**
 * Edge handles on a picture change its shape: a side edge changes only the
 * width, top or bottom only the height. The crop fills the new frame, so the
 * picture is never stretched. `apply` writes the new width and aspect.
 */
function reshape(
  w0: number,
  h0: number,
  maxW: number,
  scale: number,
  apply: (doc: SignatureDoc, b: Block, w: number, aspect: number) => void,
): NonNullable<ResizeSpec["stretch"]> {
  return (dir, sdx, sdy) => {
    // Handles move in on-screen pixels; sizes are stored before the whole-signature scale.
    const dx = sdx / scale;
    const dy = sdy / scale;
    const sx = dir === "e" ? 1 : dir === "w" ? -1 : 0;
    const sy = dir === "s" ? 1 : dir === "n" ? -1 : 0;
    const w = Math.round(Math.min(maxW, Math.max(24, w0 + sx * dx)));
    const h = Math.round(Math.max(12, h0 + sy * dy));
    const aspect = Math.round((w / h) * 1000) / 1000;
    return { patch: (d, b) => apply(d, b, w, aspect), label: `${w} × ${h}` };
  };
}

export function resizeSpec(b: Block, doc: SignatureDoc, width: number): ResizeSpec | null {
  const d = doc.design;
  const scale = clampScale(d.scale);
  const font = (start: number): ResizeSpec => ({
    axis: "x",
    start,
    min: 9,
    max: 40,
    patch: (v) => (_d, x) => void (x.style = { ...x.style, fontSize: Math.round(v) }),
    label: (v) => `${Math.round(v)}px text`,
    prefer: "y",
    presets: [
      { label: "S", value: Math.max(9, d.fontSize - 2) },
      { label: "M", value: d.fontSize },
      { label: "L", value: d.fontSize + 3 },
    ],
  });
  switch (b.type) {
    case "photo": {
      const slot = doc.images.photo;
      const meta = slot.assetId ? doc.assets[slot.assetId] : undefined;
      const w0 = b.size ?? slot.size;
      // Circles stay circles; any other frame can be reshaped from its edges.
      const round = (slot.look?.frame ?? slot.shape) === "circle";
      const h0 = Math.max(1, Math.round(w0 / (slot.aspect ?? 1)));
      return {
        dims: meta && !round ? `${w0} × ${h0}` : undefined,
        stretch:
          meta && !round
            ? reshape(w0, h0, 260, scale, (d, x, w, aspect) => {
                (x as typeof b).size = w;
                d.images.photo.aspect = aspect;
              })
            : undefined,
        axis: "x",
        start: w0,
        min: 28,
        max: 260,
        patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)),
        label: px,
        presets: [
          { label: "S", value: 56 },
          { label: "M", value: 84 },
          { label: "L", value: 120 },
        ],
      };
    }
    case "logo": {
      const slot = doc.images.logo;
      const meta = slot.assetId ? doc.assets[slot.assetId] : undefined;
      const w0 = b.size ?? slot.size;
      const h0 = meta ? Math.max(1, Math.round(w0 / (slot.aspect ?? meta.width / meta.height))) : 0;
      return {
        dims: meta ? `${w0} × ${h0}` : undefined,
        stretch: meta
          ? reshape(w0, h0, 320, scale, (d, x, w, aspect) => {
              (x as typeof b).size = w;
              d.images.logo.aspect = aspect;
            })
          : undefined,
        axis: "x",
        start: w0,
        min: 28,
        max: 320,
        patch: (v) => (_d, x) => void ((x as typeof b).size = Math.round(v)),
        label: px,
        presets: [
          { label: "S", value: 80 },
          { label: "M", value: 120 },
          { label: "L", value: 170 },
        ],
      };
    }
    case "image": {
      const meta = b.assetId ? doc.assets[b.assetId] : undefined;
      // The image's own box (its wrapper fills the column, so the canvas frame isn't its size).
      const w0 = b.width;
      const h0 = meta ? Math.max(1, Math.round(w0 / (b.aspect ?? meta.width / meta.height))) : 0;
      return {
        dims: meta ? `${w0} × ${h0}` : undefined,
        axis: "x",
        start: b.width,
        min: 40,
        max: 640,
        patch: (v) => (_d, x) => void ((x as typeof b).width = Math.round(v)),
        label: px,
        presets: [
          { label: "S", value: 160 },
          { label: "M", value: 300 },
          { label: "L", value: 480 },
          { label: "Phone", value: 340 },
        ],
        // Side edges change the width and keep the height; top and bottom change the height. The crop fills the new shape.
        stretch: meta
          ? reshape(w0, h0, 640, scale, (_d, x, w, aspect) => {
              const im = x as typeof b;
              im.width = w;
              im.aspect = aspect;
            })
          : undefined,
      };
    }
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
      // A vertical line grows up and down, like a spacer.
      if (b.vertical)
        return {
          axis: "y",
          start: b.height ?? 48,
          min: 8,
          max: 240,
          patch: (v) => (_d, x) => void ((x as typeof b).height = Math.round(v)),
          label: (v) => `${Math.round(v)}px tall`,
        };
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
    case "contacts": {
      // Corners scale the text; edges change the spacing between the fields.
      const n = contactCount(doc);
      const rows = b.layout === "stacked" ? n : Math.ceil(n / 2);
      const row0 = rowGapOf(b, d);
      const col0 = colGapOf(b, d);
      return {
        ...font(b.style?.fontSize ?? d.fontSize),
        edges: { x: hasColGap(b.layout), y: hasRowGap(b.layout) },
        stretch: (dir, sdx, sdy) => {
          const clampGap = (v: number, max: number) => Math.round(Math.min(max, Math.max(0, v)));
          if (dir === "n" || dir === "s") {
            const v = clampGap(row0 + ((dir === "s" ? 1 : -1) * sdy) / scale / Math.max(1, rows - 1), MAX_ROW_GAP);
            return { patch: (_d, x) => void ((x as typeof b).rowGap = v), label: `${v}px between rows` };
          }
          const gaps = b.layout === "inline" ? Math.max(1, n - 1) : 1;
          const v = clampGap(col0 + ((dir === "e" ? 1 : -1) * sdx) / scale / gaps, MAX_COL_GAP);
          return { patch: (_d, x) => void ((x as typeof b).colGap = v), label: `${v}px between` };
        },
      };
    }
    case "title":
    case "field":
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

/** How many lines the contacts block shows (the canvas is never the compact reply view). */
function contactCount(doc: SignatureDoc): number {
  const d = doc.details;
  const base = [d.phone, d.mobile, d.email, d.website, d.address].filter((v) => v.trim()).length;
  return base + d.custom.filter((c) => c.value.trim()).length;
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
export function handlesFor(spec: ResizeSpec, frame: { w: number; h: number } = { w: Infinity, h: Infinity }, room = EDGE_ROOM): HandleDir[] {
  if (spec.axis === "y") return ["n", "s"];
  return HANDLE_DIRS.filter((d) => {
    if (d === "e" || d === "w") return frame.h >= room && (spec.edges?.x ?? true);
    if (d === "n" || d === "s") return frame.w >= room && (spec.edges?.y ?? true);
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
  const f = sx && sy && spec.prefer === "y" ? fy : Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;
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

/** Keyboard resizing: one step (1px, or 0.05 for scales), ten with Shift. */
export function stepValue(spec: ResizeSpec, dir: 1 | -1, big = false): number {
  const unit = spec.step ?? (spec.max <= 5 ? 0.05 : 1);
  const v = spec.start + dir * unit * (big ? 10 : 1);
  return Math.round(Math.min(spec.max, Math.max(spec.min, v)) * 100) / 100;
}
