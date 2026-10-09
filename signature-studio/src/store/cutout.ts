/**
 * Remove an image's background in the browser — nothing is uploaded.
 *
 *  - Logos and graphics: the flat background is keyed out (core/cutout.ts).
 *  - Photos of people: Google's MediaPipe selfie segmenter runs on this
 *    device. Its code and model (~10 MB) are fetched once from pinned public
 *    URLs the first time someone asks for it; the picture never leaves the browser.
 */
import type { AssetMeta } from "../core/types";
import { applyMask, keyOutBackground, orientMask } from "../core/cutout";
import { ingestFile, sourceUrl, UploadError } from "./assets";

const MP_VERSION = "0.10.14";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError("The image couldn't be read."));
    img.src = src;
  });
}

async function pixels(meta: AssetMeta) {
  const src = sourceUrl(meta.id);
  if (!src) throw new UploadError("The original image is missing from this browser. Re-upload it.");
  const img = await load(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { c, ctx, img, data: ctx.getImageData(0, 0, c.width, c.height) };
}

async function save(c: HTMLCanvasElement, base: AssetMeta): Promise<AssetMeta> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new UploadError("Couldn't save the image."))), "image/png"),
  );
  const name = base.name.replace(/\.\w+$/, "") + "-cutout.png";
  const meta = await ingestFile(new File([blob], name, { type: "image/png" }));
  return { ...meta, name };
}

/** Logos: make the flat background transparent. Returns null when there's no flat background to remove. */
export async function removeFlatBackground(meta: AssetMeta, tolerance = 28): Promise<AssetMeta | null> {
  const { c, ctx, data } = await pixels(meta);
  const cleared = keyOutBackground(data.data, c.width, c.height, tolerance);
  if (cleared < c.width * c.height * 0.02) return null;
  ctx.putImageData(data, 0, 0);
  return save(c, meta);
}

type Segmenter = { segment: (img: HTMLCanvasElement) => { confidenceMasks?: { width: number; height: number; getAsFloat32Array: () => Float32Array }[] } };
let segmenter: Promise<Segmenter> | null = null;

function getSegmenter(): Promise<Segmenter> {
  segmenter ??= (async () => {
    const mp = (await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`)) as {
      FilesetResolver: { forVisionTasks: (base: string) => Promise<unknown> };
      ImageSegmenter: { createFromOptions: (fs: unknown, o: unknown) => Promise<Segmenter> };
    };
    const files = await mp.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    return mp.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })().catch((e) => {
    segmenter = null;
    throw e;
  });
  return segmenter;
}

/** Photos: keep the person, remove everything else. */
export async function cutOutPerson(meta: AssetMeta): Promise<AssetMeta> {
  const { c, ctx, data } = await pixels(meta);
  let seg: Segmenter;
  try {
    seg = await getSegmenter();
  } catch {
    throw new UploadError("Couldn't load the cut-out tool. Check your connection and try again.");
  }
  const res = seg.segment(c);
  const masks = res.confidenceMasks ?? [];
  const m = masks[masks.length > 1 ? 1 : 0];
  if (!m) throw new UploadError("Couldn't find a person in this photo.");
  let mask = m.getAsFloat32Array();
  if (m.width !== c.width || m.height !== c.height) {
    // Scale the mask up to the image.
    const scaled = new Float32Array(c.width * c.height);
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) scaled[y * c.width + x] = mask[Math.floor((y * m.height) / c.height) * m.width + Math.floor((x * m.width) / c.width)];
    mask = scaled;
  }
  mask = orientMask(mask, c.width, c.height);
  applyMask(data.data, mask);
  ctx.putImageData(data, 0, 0);
  return save(c, meta);
}
