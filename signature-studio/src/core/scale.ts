/**
 * Whole-signature scaling. Every size stored in a signature (text, images,
 * icons, spacing, widths) is multiplied by one factor before rendering, so
 * "make it 10% bigger" is one control instead of twenty.
 * The renderer scales its own built-in sizes with the same factor.
 */
import type { Block, Box, Column, SignatureDoc } from "./types";

export const MIN_SCALE = 0.7;
export const MAX_SCALE = 1.5;

export const clampScale = (s: number | undefined) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s || 1));

const r = (n: number, s: number) => Math.max(1, Math.round(n * s));
const opt = (n: number | undefined, s: number) => (n === undefined ? undefined : r(n, s));

function box(b: Box | undefined, s: number): Box | undefined {
  if (!b) return b;
  return { ...b, padding: opt(b.padding, s), radius: opt(b.radius, s) };
}

function column(c: Column, s: number): Column {
  // Gaps are multiplied by design.spacing in the renderer, which is scaled already.
  return { ...c, width: opt(c.width, s), box: box(c.box, s), blocks: c.blocks.map((b) => block(b, s)) };
}

function block(b: Block, s: number): Block {
  const style = b.style ? { ...b.style, fontSize: opt(b.style.fontSize, s), box: box(b.style.box, s) } : undefined;
  const base = { ...b, style } as Block;
  switch (base.type) {
    case "row":
      return { ...base, columns: base.columns.map((c) => column(c, s)) };
    case "text":
      return { ...base, size: opt(base.size, s) };
    case "socials":
    case "photo":
    case "logo":
      return { ...base, size: opt(base.size, s) };
    case "image":
      return { ...base, width: r(base.width, s) };
    case "monogram":
      return { ...base, size: r(base.size, s) };
    case "divider":
      return { ...base, width: opt(base.width, s) };
    case "spacer":
      return { ...base, height: r(base.height, s) };
    case "logos":
      return { ...base, height: r(base.height, s), gap: r(base.gap, s) };
    case "qr":
      return { ...base, size: r(base.size, s) };
    default:
      return base;
  }
}

/** A copy of the signature with every stored size multiplied by `s`. */
export function scaleDoc(doc: SignatureDoc, s: number): SignatureDoc {
  if (s === 1) return doc;
  const d = doc.design;
  return {
    ...doc,
    design: {
      ...d,
      fontSize: Math.max(8, Math.round(d.fontSize * s)),
      spacing: d.spacing * s,
      width: r(d.width, s),
      social: { ...d.social, size: r(d.social.size, s), gap: r(d.social.gap, s) },
    },
    images: {
      photo: { ...doc.images.photo, size: r(doc.images.photo.size, s) },
      logo: { ...doc.images.logo, size: r(doc.images.logo.size, s) },
    },
    card: { ...doc.card, width: r(doc.card.width, s) },
    addons: { ...doc.addons, banner: { ...doc.addons.banner, width: r(doc.addons.banner.width, s) } },
    blocks: doc.blocks ? column(doc.blocks, s) : undefined,
    replyBlocks: doc.replyBlocks ? column(doc.replyBlocks, s) : undefined,
  };
}
