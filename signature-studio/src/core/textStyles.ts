/**
 * Text styles: named typography that blocks link to, like styles in a design
 * tool. Change the style and every block using it follows; a block's own
 * settings still win where it has them. Pure.
 */
import type { Block, BlockStyle, Design, TextStyleDef } from "./types";

export const STYLE_FIELDS = ["font", "fontSize", "weight", "italic", "case", "lineHeight", "tracking", "colorRole", "color"] as const;
type Field = (typeof STYLE_FIELDS)[number];

export function findStyle(d: Design, id: string | undefined): TextStyleDef | undefined {
  return id ? d.textStyles?.find((s) => s.id === id) : undefined;
}

/** The block's style with its text style's fields filled in underneath. */
export function effectiveStyle(st: BlockStyle | undefined, d: Design): BlockStyle | undefined {
  const def = findStyle(d, st?.textStyle);
  if (!def) return st;
  const base: BlockStyle = {};
  for (const k of STYLE_FIELDS) if (def[k] !== undefined) (base as Record<Field, unknown>)[k] = def[k];
  // A custom colour on the block beats the style's colour role, and vice versa.
  const own = { ...st };
  if (own.color) delete base.colorRole;
  if (own.colorRole) delete base.color;
  return { ...base, ...own };
}

/** The same block with its text style resolved (for the renderer). */
export function resolveBlockStyle(b: Block, d: Design): Block {
  return b.style?.textStyle ? ({ ...b, style: effectiveStyle(b.style, d) } as Block) : b;
}

/** A new style from a block's current typography. */
export function styleFromBlock(id: string, name: string, st: BlockStyle | undefined): TextStyleDef {
  const out: TextStyleDef = { id, name };
  for (const k of STYLE_FIELDS) if (st?.[k] !== undefined) (out as Record<Field, unknown>)[k] = st[k];
  return out;
}

/** Link a block to a style: its own typography is cleared so the style shows through. */
export function applyStyle(st: BlockStyle | undefined, id: string | undefined): BlockStyle {
  const next: BlockStyle = { ...st, textStyle: id };
  for (const k of STYLE_FIELDS) delete next[k];
  if (!id) delete next.textStyle;
  return next;
}

/** Does the block override anything its style sets? */
export function overridesStyle(st: BlockStyle | undefined, d: Design): boolean {
  const def = findStyle(d, st?.textStyle);
  return !!def && STYLE_FIELDS.some((k) => st?.[k] !== undefined && st[k] !== def[k]);
}
