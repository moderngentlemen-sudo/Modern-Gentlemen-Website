/**
 * Snapping for the canvas handles: sizes click into place when they're close
 * to something meaningful — another block's size, the default text size, an
 * even split of a row — and the canvas shows what they matched.
 */
import { rowOfColumn, walk } from "../core/blocks";
import type { Block, Column, SignatureDoc } from "../core/types";
import { blockLabel } from "./catalog";

export interface Snap {
  value: number;
  /** What it matched, for the on-canvas label. */
  match?: string;
}

const PX_TYPES = new Set(["photo", "logo", "image", "monogram", "qr", "logos", "canva"]);

/** The size a pixel-sized block currently has (for matching). */
function pxSize(b: Block, doc: SignatureDoc): number | undefined {
  switch (b.type) {
    case "photo":
      return b.size ?? doc.images.photo.size;
    case "logo":
      return b.size ?? doc.images.logo.size;
    case "image":
      return b.width;
    case "monogram":
    case "qr":
      return b.size;
    case "logos":
      return b.height;
    case "canva":
      return doc.card.width;
    default:
      return undefined;
  }
}

function fontSize(b: Block): number | undefined {
  if (b.type === "text") return b.size ?? b.style?.fontSize;
  if (["title", "field", "contacts", "button", "iconText", "tag", "quote", "reviews"].includes(b.type)) return b.style?.fontSize;
  return undefined;
}

/** Snap a resize value for block `id`. `kind` is "px" for image-like sizes, "font" for text. */
export function snapResize(doc: SignatureDoc, id: string, value: number, kind: "px" | "font" | "none", tolerance = kind === "font" ? 0.6 : 4): Snap {
  if (kind === "none" || !doc.blocks) return { value };
  const candidates: { v: number; label: string }[] = [];
  for (const { block } of walk(doc.blocks)) {
    if (block.id === id) continue;
    const v = kind === "px" ? (PX_TYPES.has(block.type) ? pxSize(block, doc) : undefined) : fontSize(block);
    if (v) candidates.push({ v, label: blockLabel(block) });
  }
  if (kind === "font") candidates.push({ v: doc.design.fontSize, label: "body text" });
  let best: Snap = { value };
  let gap = tolerance + 1e-9;
  for (const c of candidates) {
    const g = Math.abs(c.v - value);
    if (g <= gap) {
      gap = g;
      best = { value: c.v, match: c.label };
    }
  }
  return best;
}

/** Snap a column width: even splits of its row, and the other columns' widths. */
export function snapColumn(root: Column, colId: string, value: number, rowWidth: number, tolerance = 6): Snap {
  const row = rowOfColumn(root, colId);
  if (!row) return { value };
  const n = row.columns.length;
  const candidates: { v: number; label: string }[] = [];
  for (const f of n === 2 ? [1 / 3, 1 / 2, 2 / 3] : n === 3 ? [1 / 4, 1 / 3, 1 / 2] : [1 / n])
    candidates.push({ v: Math.round(rowWidth * f), label: `${Math.round(f * 100)}%` });
  row.columns.forEach((c, i) => c.id !== colId && c.width && candidates.push({ v: c.width, label: `column ${i + 1}` }));
  let best: Snap = { value: Math.round(value) };
  let gap = tolerance + 1e-9;
  for (const c of candidates) {
    const g = Math.abs(c.v - value);
    if (g <= gap) {
      gap = g;
      best = { value: c.v, match: c.label };
    }
  }
  return best;
}

export function resizeKind(b: Block): "px" | "font" | "none" {
  if (PX_TYPES.has(b.type)) return "px";
  if (b.type === "spacer" || b.type === "divider" || b.type === "name" || b.type === "socials") return "none";
  return "font";
}
