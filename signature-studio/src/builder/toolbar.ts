/** Placement of the floating block toolbar on the canvas (pure, unit-tested). */
export type Rect = { x: number; y: number; w: number; h: number };

const TOOLBAR_H = 32;
const TOOLBAR_W = 230;
const area = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const contains = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x + 0.5 && outer.y <= inner.y + 0.5 && outer.x + outer.w >= inner.x + inner.w - 0.5 && outer.y + outer.h >= inner.y + inner.h - 0.5;

/**
 * Where the block toolbar goes: above the selection or below it, whichever
 * hides less of the other blocks (the selection's own rows and children don't
 * count). Ties go above; there must be room above the stage's top edge.
 */
export function toolbarTop(sel: Rect, rects: Record<string, Rect>, selId: string): number {
  const above = sel.y - TOOLBAR_H - 8;
  const below = sel.y + sel.h + 12;
  const others = Object.entries(rects)
    .filter(([id, r]) => id !== selId && !contains(r, sel) && !contains(sel, r))
    .map(([, r]) => r);
  const cost = (top: number) => others.reduce((n, r) => n + area({ x: sel.x, y: top, w: TOOLBAR_W, h: TOOLBAR_H }, r), 0);
  if (above < 0) return below;
  return cost(below) < cost(above) ? below : above;
}
