/**
 * Image ingestion and in-memory object URLs for asset sources.
 *
 * Uploads are validated (type, size, decodability), SVGs are rasterised so
 * user SVG markup is never rendered, and very large images are downscaled
 * so they cannot degrade the editor.
 */
import { uid } from "../lib/id";
import { sha256Hex } from "../lib/hash";
import type { AssetMeta, AssetOrigin } from "../core/types";
import { straightenScale } from "../core/imageLook";
import { assetStore } from "../storage/db";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
export const ACCEPT_ATTR = ACCEPTED.join(",");

const urls = new Map<string, string>();
const listeners = new Set<() => void>();

export function sourceUrl(assetId: string): string | null {
  return urls.get(assetId) ?? null;
}

export function onSourcesChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function register(id: string, blob: Blob) {
  const prev = urls.get(id);
  if (prev) URL.revokeObjectURL(prev);
  urls.set(id, URL.createObjectURL(blob));
  listeners.forEach((fn) => fn());
}

/** Ensure object URLs exist for the given asset ids (after loading a project). */
export async function hydrateSources(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      if (urls.has(id) || id.startsWith("builtin:")) return;
      const blob = await assetStore.get(id);
      if (blob) register(id, blob);
      else missing.push(id);
    }),
  );
  return missing;
}

export class UploadError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError("This image couldn't be read. It may be damaged or in an unsupported format."));
    img.src = src;
  });
}

async function rasterize(img: HTMLImageElement, w: number, h: number, mime: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new UploadError("Couldn't process this image."))), mime, 0.92));
}

/** Validate and store an uploaded file. Returns its asset metadata. */
export async function ingestFile(file: File | Blob, name = "image"): Promise<AssetMeta> {
  const type = file.type || "";
  if (!ACCEPTED.includes(type)) throw new UploadError("Please use a PNG, JPEG, WebP, GIF or SVG image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("That image is larger than 15 MB. Please use a smaller file.");
  const tempUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(tempUrl);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (type === "image/svg+xml" && (!w || !h)) {
      w = 1200;
      h = 1200;
    }
    if (!w || !h) throw new UploadError("This image has no dimensions.");
    let blob: Blob = file;
    let mime = type;
    const longEdge = Math.max(w, h);
    if (type === "image/svg+xml" || longEdge > MAX_EDGE || type === "image/webp") {
      // SVGs and oversized images become a safe, bounded PNG/JPEG. GIFs within
      // bounds stay GIFs, so animated banners keep moving (see core/gif.ts).
      const scale = Math.min(1, (type === "image/svg+xml" ? 1600 : MAX_EDGE) / longEdge);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      mime = type === "image/jpeg" ? "image/jpeg" : "image/png";
      // An oversized GIF can't be resized without losing its frames: it becomes a still.
      blob = await rasterize(img, w, h, mime);
    }
    const hash = await sha256Hex(blob);
    const id = uid("a");
    await assetStore.put(id, blob);
    register(id, blob);
    return { id, name: (file as File).name ?? name, mime, width: w, height: h, bytes: blob.size, hash };
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

/** Restore an asset from a data URL (project import). */
export async function ingestDataUrl(id: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  await assetStore.put(id, blob);
  register(id, blob);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Dominant colours of an image, for brand-palette extraction. */
export async function extractColors(assetId: string, count = 5): Promise<string[]> {
  const src = sourceUrl(assetId);
  if (!src) return [];
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { r: number; g: number; b: number; pixels: number; score: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Skip near-white backgrounds.
    if (Math.min(r, g, b) > 235) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, pixels: 0, score: 0 };
    e.r += r;
    e.g += g;
    e.b += b;
    e.pixels += 1;
    // Favour saturated colours slightly over greys.
    e.score += 1 + (Math.max(r, g, b) - Math.min(r, g, b)) / 64;
    buckets.set(key, e);
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((e) => `#${hex(e.r / e.pixels)}${hex(e.g / e.pixels)}${hex(e.b / e.pixels)}`);
}

export interface TrimResult {
  meta: AssetMeta;
  /** The kept area, in source pixels, and the original size. */
  box: { x: number; y: number; w: number; h: number; W: number; H: number };
}

/**
 * Remove empty margins around a design (transparent, or the flat colour of
 * the corners) — Canva exports the whole page, even the unused part.
 * Returns null when there is nothing to trim.
 */
export async function trimImage(assetId: string, mime: string): Promise<TrimResult | null> {
  const src = sourceUrl(assetId);
  if (!src) return null;
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number) => (y * W + x) * 4;
  const bg = [data[0], data[1], data[2], data[3]];
  const empty = (i: number) =>
    data[i + 3] < 10 ||
    (bg[3] > 245 && Math.abs(data[i] - bg[0]) < 10 && Math.abs(data[i + 1] - bg[1]) < 10 && Math.abs(data[i + 2] - bg[2]) < 10 && data[i + 3] > 245);
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!empty(at(x, y))) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  // Keep a hair of breathing room so anti-aliased edges aren't clipped.
  const pad = Math.round(Math.max(W, H) * 0.004);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w >= W - 2 && h >= H - 2) return null;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  const type = mime === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new UploadError("Couldn't trim this image."))), type, 0.95),
  );
  const meta = await ingestFile(new File([blob], "design-trimmed." + (type === "image/png" ? "png" : "jpg"), { type }));
  return { meta, box: { x: x0, y: y0, w, h, W, H } };
}

/** Display width for an imported design: exports at 2× show at half size, so they're sharp on retina screens. */
export function designDisplayWidth(naturalWidth: number): number {
  return Math.max(160, Math.min(600, naturalWidth >= 640 ? Math.round(naturalWidth / 2) : naturalWidth));
}

const darkRisk = new Map<string, boolean>();

/**
 * Would this logo vanish in dark mode? True for transparent images whose
 * visible pixels are mostly dark — dark text on nothing, which dark inboxes
 * put on a near-black background.
 */
export async function darkModeRisk(assetId: string): Promise<boolean> {
  if (darkRisk.has(assetId)) return darkRisk.get(assetId)!;
  const src = sourceUrl(assetId);
  if (!src) return false;
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let clear = 0;
  let opaque = 0;
  let lum = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) clear++;
    else {
      opaque++;
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
  }
  const risk = clear / (size * size) > 0.2 && opaque > 0 && lum / opaque < 0.25;
  darkRisk.set(assetId, risk);
  return risk;
}

function toBlob(c: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new UploadError("Couldn't process this image."))), type, 0.95));
}

/**
 * Rotate, flip and straighten an image into a new asset that remembers how it
 * was made (`origin`), so later edits start again from the untouched original.
 */
export async function orientAsset(base: AssetMeta, o: Omit<AssetOrigin, "id">): Promise<AssetMeta> {
  const src = sourceUrl(base.id);
  if (!src) throw new UploadError("The original image is missing from this browser. Re-upload it.");
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const quarter = o.rotate === 90 || o.rotate === 270;
  const w = quarter ? H : W;
  const h = quarter ? W : H;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(w / 2, h / 2);
  const tilt = o.straighten ?? 0;
  if (tilt) {
    // Rotate a little and zoom just enough that no empty corner shows.
    const k = straightenScale(w, h, tilt);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.scale(k, k);
  }
  ctx.rotate((o.rotate * Math.PI) / 180);
  ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
  ctx.drawImage(img, -W / 2, -H / 2);
  const type = base.mime === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await toBlob(c, type);
  const meta = await ingestFile(new File([blob], base.name, { type }));
  return { ...meta, name: base.name, origin: { id: base.id, ...o } };
}

/**
 * Where the subject probably is (0…1 on each axis): the centre of mass of
 * detail and of whatever differs from the background. Good enough to centre
 * a headshot or a product in its frame.
 */
export async function subjectCenter(assetId: string): Promise<{ x: number; y: number } | null> {
  const src = sourceUrl(assetId);
  if (!src) return null;
  const img = await loadImage(src);
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const lum = (i: number) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255);
  const bg = [0, (S - 1) * 4, S * (S - 1) * 4, (S * S - 1) * 4].map(lum).reduce((a, b) => a + b) / 4;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++) {
      const i = (y * S + x) * 4;
      const edge = Math.abs(lum(i + 4) - lum(i - 4)) + Math.abs(lum(i + S * 4) - lum(i - S * 4));
      const wgt = edge + Math.abs(lum(i) - bg) * 0.5;
      sx += x * wgt;
      sy += y * wgt;
      sw += wgt;
    }
  if (sw < 1) return null;
  return { x: sx / sw / (S - 1), y: sy / sw / (S - 1) };
}

/** Is this asset the result of a rotate/flip/straighten, and is its original still here? */
export const originOf = (meta: AssetMeta | undefined, assets: Record<string, AssetMeta>) => (meta?.origin && assets[meta.origin.id] ? meta.origin : null);
