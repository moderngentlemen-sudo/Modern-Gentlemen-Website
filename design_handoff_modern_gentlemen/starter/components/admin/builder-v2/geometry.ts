import type { VisualStyle } from "@/lib/blocks/visual";

export const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Handle = "move" | (typeof HANDLES)[number];
export type Rect = { x: number; y: number; width: number; height: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** One gesture, one result. Pointer travel is already in canvas CSS pixels. */
export function gestureStyle(
  start: VisualStyle,
  rect: Rect,
  handle: Handle,
  dx: number,
  dy: number
): VisualStyle {
  let width = rect.width,
    height = rect.height,
    left = start.left ?? 0,
    top = start.top ?? 0;
  if (handle === "move") {
    left += dx;
    top += dy;
  } else {
    if (handle.includes("e")) width = clamp(width + dx, 24, 4000);
    if (handle.includes("s")) height = clamp(height + dy, 24, 4000);
    if (handle.includes("w")) {
      width = clamp(width - dx, 24, 4000);
      left += rect.width - width;
    }
    if (handle.includes("n")) {
      height = clamp(height - dy, 24, 4000);
      top += rect.height - height;
    }
  }
  return {
    ...start,
    position: start.position === "absolute" ? "absolute" : "relative",
    left: clamp(left, -4000, 4000),
    top: clamp(top, -4000, 4000),
    ...(handle === "move"
      ? {}
      : { width: undefined, widthPercent: undefined, widthPx: width, heightPx: height }),
  };
}

export function alignMove(
  rect: Rect,
  peers: Rect[],
  tolerance = 6
): { dx: number; dy: number; x?: number; y?: number } {
  const result: { dx: number; dy: number; x?: number; y?: number } = { dx: 0, dy: 0 };
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    let best = tolerance + 1;
    for (const peer of peers)
      for (const target of [peer[axis], peer[axis] + peer[size] / 2, peer[axis] + peer[size]]) {
        for (const anchor of [rect[axis], rect[axis] + rect[size] / 2, rect[axis] + rect[size]]) {
          const delta = target - anchor;
          if (Math.abs(delta) <= tolerance && Math.abs(delta) < best) {
            best = Math.abs(delta);
            result[axis === "x" ? "dx" : "dy"] = delta;
            result[axis] = target;
          }
        }
      }
  }
  return result;
}
