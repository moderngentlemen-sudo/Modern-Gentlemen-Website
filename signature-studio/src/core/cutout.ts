/**
 * Background removal, pure pixel work (no DOM):
 *
 *  - `keyOutBackground`: for logos and graphics on a flat background. Floods
 *    in from the edges through pixels close to the background colour, so a
 *    white logo detail inside a white page survives when it isn't connected
 *    to the edge. Edges are feathered by colour distance.
 *  - `applyMask`: for photos, with a person-confidence mask from a segmentation
 *    model; `orientMask` makes sure the mask means "keep" in the middle.
 */

/** The background colour: the most common colour along the image's border. */
export function borderColor(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[i];
    e.g += data[i + 1];
    e.b += data[i + 2];
    counts.set(key, e);
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  let best = { n: 0, r: 255, g: 255, b: 255 };
  for (const e of counts.values()) if (e.n > best.n) best = e;
  return best.n ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255];
}

/**
 * Make the flat background transparent. `tolerance` is a colour distance
 * (0–255); pixels within it are removed, pixels within twice it are faded.
 * Returns how many pixels became fully transparent.
 */
export function keyOutBackground(data: Uint8ClampedArray, w: number, h: number, tolerance = 28): number {
  const [br, bg, bb] = borderColor(data, w, h);
  const dist = (i: number) => Math.max(Math.abs(data[i] - br), Math.abs(data[i + 1] - bg), Math.abs(data[i + 2] - bb));
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (data[p * 4 + 3] < 10 || dist(p * 4) <= tolerance * 2) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    const d = dist(i);
    if (d <= tolerance) {
      if (data[i + 3]) cleared++;
      data[i + 3] = 0;
    } else {
      // Anti-aliased edge: fade by how close it is to the background, and stop spreading.
      data[i + 3] = Math.round(data[i + 3] * Math.min(1, (d - tolerance) / tolerance));
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return cleared;
}

/** Flip a confidence mask if it says "keep" around the edges rather than in the middle. */
export function orientMask(mask: Float32Array, w: number, h: number): Float32Array {
  let edge = 0;
  let edgeN = 0;
  let mid = 0;
  let midN = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = mask[y * w + x];
      if (x < w * 0.08 || x > w * 0.92 || y < h * 0.08) {
        edge += v;
        edgeN++;
      } else if (x > w * 0.3 && x < w * 0.7 && y > h * 0.25 && y < h * 0.75) {
        mid += v;
        midN++;
      }
    }
  if (edgeN && midN && edge / edgeN > mid / midN) return mask.map((v) => 1 - v);
  return mask;
}

/** Use a 0…1 mask (same size as the image) as transparency, with a soft but tight edge. */
export function applyMask(data: Uint8ClampedArray, mask: Float32Array): void {
  for (let p = 0; p < mask.length; p++) {
    const t = Math.min(1, Math.max(0, (mask[p] - 0.35) / 0.3));
    const s = t * t * (3 - 2 * t);
    data[p * 4 + 3] = Math.round(data[p * 4 + 3] * s);
  }
}
