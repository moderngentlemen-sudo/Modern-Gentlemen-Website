/**
 * Animated GIFs: sent as the original file (so they keep moving) only when
 * nothing has to be baked into them — no crop, no rounding, no shape — and
 * they fit the image host's 1 MB limit. Otherwise they are sent as a still.
 */
import type { AssetMeta } from "./types";

export const GIF_MAX_BYTES = 1024 * 1024;

export interface FrameSpec {
  /** Source rectangle taken from the image. */
  rect: { sx: number; sy: number; sw: number; sh: number };
  shape: "square" | "rounded" | "circle";
}

/** Why a GIF would lose its animation, or null when it keeps it (or isn't a GIF). */
export function gifStillReason(meta: AssetMeta | undefined, frame: FrameSpec): "cropped" | "shaped" | "too-big" | null {
  if (!meta || meta.mime !== "image/gif") return null;
  if (frame.shape !== "square") return "shaped";
  const full = frame.rect.sx <= 0.5 && frame.rect.sy <= 0.5 && Math.abs(frame.rect.sw - meta.width) <= 1 && Math.abs(frame.rect.sh - meta.height) <= 1;
  if (!full) return "cropped";
  if (meta.bytes > GIF_MAX_BYTES) return "too-big";
  return null;
}
