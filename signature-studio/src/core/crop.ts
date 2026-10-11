export interface ImageCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Source rectangle for a "cover" crop of a natural image into a frame with
 * the given aspect ratio, with zoom (≥1) and pan (-1..1 on each axis).
 * Shared by the editor preview (CSS) and the publish pipeline (canvas) so the
 * two always agree.
 */
export function cropRect(naturalW: number, naturalH: number, frameAspect: number, crop: ImageCrop): Rect {
  const zoom = Math.max(1, crop.zoom || 1);
  const natAspect = naturalW / naturalH;
  let sw: number;
  let sh: number;
  if (natAspect > frameAspect) {
    sh = naturalH;
    sw = sh * frameAspect;
  } else {
    sw = naturalW;
    sh = sw / frameAspect;
  }
  sw /= zoom;
  sh /= zoom;
  const maxX = (naturalW - sw) / 2;
  const maxY = (naturalH - sh) / 2;
  const px = Math.max(-1, Math.min(1, crop.x || 0));
  const py = Math.max(-1, Math.min(1, crop.y || 0));
  return { sx: maxX + px * maxX, sy: maxY + py * maxY, sw, sh };
}

/** Frame size in display px for an image node. */
export function frameSize(width: number, aspect: number | undefined, naturalW: number, naturalH: number) {
  const a = aspect ?? naturalW / naturalH;
  return { w: Math.round(width), h: Math.max(1, Math.round(width / a)), aspect: a };
}

/** Smallest zoom: the picture can shrink to this fraction of the size that just fills its frame. */
export const MIN_ZOOM = 0.25;

export interface Placement {
  /** Part of the picture that shows, in source pixels. */
  src: Rect;
  /** Where it is drawn inside the frame, in frame units (0…frameW, 0…frameH). */
  dst: { x: number; y: number; w: number; h: number };
  /** True when the picture doesn't reach every edge (zoomed out): the rest of the frame is empty. */
  inset: boolean;
}

/**
 * Where a picture sits in its frame for any zoom. At zoom ≥ 1 it fills the
 * frame and is cropped (exactly `cropRect`). Zoomed out below 1, it shrinks
 * inside the frame; on each axis where it no longer reaches both edges, the
 * pan moves it within the free space instead of cropping it.
 */
export function cropPlacement(naturalW: number, naturalH: number, frameW: number, frameH: number, crop: ImageCrop): Placement {
  const zoom = Math.max(MIN_ZOOM, crop.zoom || 1);
  if (zoom >= 1) return { src: cropRect(naturalW, naturalH, frameW / frameH, crop), dst: { x: 0, y: 0, w: frameW, h: frameH }, inset: false };
  // Scale that just covers the frame, then shrink.
  const k = Math.max(frameW / naturalW, frameH / naturalH) * zoom;
  const axis = (natural: number, frame: number, pan: number) => {
    const drawn = natural * k;
    const p = Math.max(-1, Math.min(1, pan || 0));
    if (drawn >= frame) {
      // Still wider than the frame on this axis: crop, as at zoom ≥ 1.
      const s = frame / k;
      const max = (natural - s) / 2;
      return { s0: max + p * max, s, d0: 0, d: frame };
    }
    // Smaller than the frame: show it all; the pan places it (−1 = start, 1 = end, like dragging).
    return { s0: 0, s: natural, d0: ((frame - drawn) / 2) * (1 - p), d: drawn };
  };
  const ax = axis(naturalW, frameW, crop.x);
  const ay = axis(naturalH, frameH, crop.y);
  return {
    src: { sx: ax.s0, sy: ay.s0, sw: ax.s, sh: ay.s },
    dst: { x: ax.d0, y: ay.d0, w: ax.d, h: ay.d },
    inset: ax.d < frameW - 0.01 || ay.d < frameH - 0.01,
  };
}
