export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SnapResult {
  x: number;
  y: number;
  vertical?: number;
  horizontal?: number;
  gap?: number;
}
/** Coordinates and tolerance use unzoomed canvas pixels. Never mutates measured peers. */
export function snapFreeRect(rect: CanvasRect, peers: CanvasRect[], tolerance: number): SnapResult {
  const result: SnapResult = { x: rect.x, y: rect.y };
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const anchors = [rect[axis], rect[axis] + rect[size] / 2, rect[axis] + rect[size]];
    let best: { delta: number; target: number } | undefined;
    for (const peer of peers)
      for (const target of [peer[axis], peer[axis] + peer[size] / 2, peer[axis] + peer[size]])
        for (const anchor of anchors) {
          const delta = target - anchor;
          if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta)))
            best = { delta, target };
        }
    if (best) {
      result[axis] += best.delta;
      result[axis === "x" ? "vertical" : "horizontal"] = best.target;
    }
  }
  const neighbours = peers.filter(
    (p) =>
      Math.abs(p.y + p.height / 2 - (rect.y + rect.height / 2)) <
      Math.max(p.height, rect.height) / 2
  );
  let closest = Infinity;
  for (const left of neighbours)
    for (const right of neighbours) {
      const gap = (right.x - left.x - left.width - rect.width) / 2;
      if (right.x <= left.x || gap < 0) continue;
      const x = left.x + left.width + gap,
        delta = Math.abs(x - rect.x);
      if (delta <= tolerance && delta < closest) {
        closest = delta;
        result.x = x;
        result.gap = gap;
        result.vertical = undefined;
      }
    }
  return result;
}
