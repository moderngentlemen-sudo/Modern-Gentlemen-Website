import { z } from "zod";

/**
 * The Stage: a full-bleed canvas whose elements sit anywhere, at any size.
 *
 * Positions are **percentages of the stage** and sizes are **a width
 * percentage plus a scale**, stored separately per device. That is what lets a
 * composition laid out on a 1440px desktop keep its proportions at 1280 or
 * 1920 rather than drifting, which pixel offsets cannot do.
 *
 * Scaling is pure CSS, so the public page ships no layout JavaScript:
 *
 * - the stage is an inline-size container, so `100cqw` is its width;
 * - `tan(atan2(100cqw, 1440px))` divides one length by another, giving the
 *   ratio of the stage to the design width (supported by every current
 *   browser; it is the standard way to divide lengths in CSS);
 * - each element's content wrapper is `zoom`ed by that ratio times its own
 *   scale. Unlike `transform`, `zoom` affects layout, so the element's box,
 *   and the editor's selection outline, match what is drawn.
 *
 * Tablet falls back to the desktop placement. Phones **stack** the elements in
 * reading order by default (the reliable small-screen layout); a stage can
 * switch phones to free placement, which then falls back to tablet, then
 * desktop.
 */

export const STAGE_DEVICES = ["desktop", "tablet", "mobile"] as const;
export type StageDevice = (typeof STAGE_DEVICES)[number];

/**
 * The width every composition is designed at, in CSS px, on every device.
 * One value on purpose: smaller devices fall back to larger placements, and
 * they must scale by the same rule to stay in proportion.
 */
export const STAGE_DESIGN_WIDTH = 1440;

export const STAGE_LIMITS = {
  x: [-50, 150],
  y: [-50, 150],
  w: [2, 100],
  scale: [0.1, 6],
  z: [0, 50],
} as const;

export const stagePlacementSchema = z
  .object({
    /** Left edge, as a percentage of the stage width. */
    x: z.number().finite().min(STAGE_LIMITS.x[0]).max(STAGE_LIMITS.x[1]),
    /** Top edge, as a percentage of the stage height. */
    y: z.number().finite().min(STAGE_LIMITS.y[0]).max(STAGE_LIMITS.y[1]),
    /** Width at scale 1, as a percentage of the stage width. */
    w: z.number().finite().min(STAGE_LIMITS.w[0]).max(STAGE_LIMITS.w[1]),
    /** Proportional size: text, spacing and media all scale together. */
    scale: z.number().finite().min(STAGE_LIMITS.scale[0]).max(STAGE_LIMITS.scale[1]),
    /** Stacking order: higher sits in front. */
    z: z.number().int().min(STAGE_LIMITS.z[0]).max(STAGE_LIMITS.z[1]),
  })
  .strict();

export const responsiveStageSchema = z
  .object({
    desktop: stagePlacementSchema.optional(),
    tablet: stagePlacementSchema.optional(),
    mobile: stagePlacementSchema.optional(),
  })
  .strict();

export type StagePlacement = z.infer<typeof stagePlacementSchema>;
export type ResponsiveStage = z.infer<typeof responsiveStageSchema>;

const round = (n: number, step = 0.1) => Math.round(n / step) * step;
const clamp = (n: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, n));

/** Clamps and rounds every value, so stored data is always schema-valid. */
export function boundStage(p: StagePlacement): StagePlacement {
  return {
    x: round(clamp(p.x, STAGE_LIMITS.x)),
    y: round(clamp(p.y, STAGE_LIMITS.y)),
    w: round(clamp(p.w, STAGE_LIMITS.w)),
    scale: round(clamp(p.scale, STAGE_LIMITS.scale), 0.01),
    z: Math.round(clamp(p.z, STAGE_LIMITS.z)),
  };
}

/**
 * Where an element with no stored desktop placement appears: centred, and
 * cascaded by its index so freshly inserted elements never land exactly on top
 * of each other.
 */
export function defaultStagePlacement(index = 0): StagePlacement {
  const step = (index % 8) * 4;
  return { x: 30 + step / 2, y: 30 + step, w: 40, scale: 1, z: 1 };
}

/**
 * The placement that applies on a device, following the fallback chain.
 * Returns `null` for a phone in stack mode: the element flows in order.
 */
export function stagePlacement(
  stage: ResponsiveStage | undefined,
  device: StageDevice,
  options: { index?: number; mobileFree?: boolean } = {}
): StagePlacement | null {
  const parse = (d: StageDevice) => stagePlacementSchema.safeParse(stage?.[d]).data;
  const desktop = parse("desktop") ?? defaultStagePlacement(options.index);
  if (device === "desktop") return desktop;
  const tablet = parse("tablet") ?? desktop;
  if (device === "tablet") return tablet;
  if (!options.mobileFree) return null;
  return parse("mobile") ?? tablet;
}

/**
 * CSS custom properties for one element: every device's placement, already
 * resolved through the fallback chain, so the stylesheet only has to pick a
 * set. Percentages and plain numbers only; nothing user-authored reaches CSS
 * as a string.
 */
export function stageVariables(
  stage: ResponsiveStage | undefined,
  options: { index?: number; mobileFree?: boolean } = {}
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const device of STAGE_DEVICES) {
    const p = stagePlacement(stage, device, { ...options, mobileFree: true });
    if (!p) continue;
    const d = device[0];
    out[`--s${d}-x`] = `${p.x}%`;
    out[`--s${d}-y`] = `${p.y}%`;
    out[`--s${d}-w`] = `${p.w * p.scale}%`;
    out[`--s${d}-s`] = p.scale;
    out[`--s${d}-z`] = p.z;
  }
  return out;
}

/**
 * A pointer drag, in stage percentages. Moves keep the size. Corners scale the
 * whole element (text, spacing and media together) from the opposite corner;
 * the east and west sides change the wrap width. Height always follows the
 * content, so the north and south sides move the element instead.
 *
 * `hPct` is the element's current drawn height as a percentage of the stage
 * height, measured by the caller, which is what lets a north corner keep the
 * bottom edge still.
 */
export function dragStage(
  start: StagePlacement,
  edge: "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
  dxPct: number,
  dyPct: number,
  hPct = 0
): StagePlacement {
  if (edge === "move") return boundStage({ ...start, x: start.x + dxPct, y: start.y + dyPct });
  const visualW = start.w * start.scale;
  if (edge.length === 2) {
    const sign = edge.includes("w") ? -1 : 1;
    const target = Math.max(STAGE_LIMITS.w[0], visualW + sign * dxPct);
    const scale = clamp(start.scale * (target / visualW), STAGE_LIMITS.scale);
    const ratio = scale / start.scale;
    const next = { ...start, scale };
    if (edge.includes("w")) next.x = start.x + visualW * (1 - ratio);
    if (edge.includes("n")) next.y = start.y + hPct * (1 - ratio);
    return boundStage(next);
  }
  if (edge === "e") return boundStage({ ...start, w: (visualW + dxPct) / start.scale });
  if (edge === "w") {
    const w = clamp((visualW - dxPct) / start.scale, STAGE_LIMITS.w);
    return boundStage({ ...start, w, x: start.x + (visualW - w * start.scale) });
  }
  return boundStage({ ...start, y: start.y + dyPct });
}

/** Arrow-key nudges: 0.5% of the stage, or 5% with Shift. */
export function nudgeStage(p: StagePlacement, dx: number, dy: number, big = false): StagePlacement {
  const step = big ? 5 : 0.5;
  return boundStage({ ...p, x: p.x + dx * step, y: p.y + dy * step });
}

export interface StageSnap {
  x: number;
  y: number;
  /** Guide positions in stage percentages, for drawing. */
  vertical?: number;
  horizontal?: number;
}

/**
 * Snaps a moving box (all in stage percentages) to the stage's centre lines
 * and edges and to other elements' edges and centres, within `tolerance`.
 */
export function snapStage(
  box: { x: number; y: number; w: number; h: number },
  peers: { x: number; y: number; w: number; h: number }[],
  tolerance = 1
): StageSnap {
  const xs = [0, 50, 100, ...peers.flatMap((p) => [p.x, p.x + p.w / 2, p.x + p.w])];
  const ys = [0, 50, 100, ...peers.flatMap((p) => [p.y, p.y + p.h / 2, p.y + p.h])];
  const pick = (candidates: number[], edges: number[]) => {
    let best: { delta: number; line: number } | null = null;
    for (const line of candidates)
      for (const edge of edges) {
        const delta = line - edge;
        if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta)))
          best = { delta, line };
      }
    return best;
  };
  const sx = pick(xs, [box.x, box.x + box.w / 2, box.x + box.w]);
  const sy = pick(ys, [box.y, box.y + box.h / 2, box.y + box.h]);
  return {
    x: box.x + (sx?.delta ?? 0),
    y: box.y + (sy?.delta ?? 0),
    vertical: sx?.line,
    horizontal: sy?.line,
  };
}
