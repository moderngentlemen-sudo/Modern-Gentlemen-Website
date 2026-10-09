/**
 * Turn an image request into the exact PNG/JPEG a recipient downloads, at 2×.
 */
import type { ImageRequest } from "../render/render";
import { estimateScriptWidth, SCRIPT_FONT } from "../render/render";
import { badgeSvg, glyphSvg, qrSvg, socialSvg, svgDataUrl } from "../render/icons";
import { GLYPH_PATHS } from "../core/iconPaths";
import { sourceUrl } from "../store/assets";
import { gifStillReason } from "../core/gif";
import type { AssetMeta } from "../core/types";

export const DENSITY = 2;

export interface Derivative {
  blob: Blob;
  mime: "image/png" | "image/jpeg" | "image/gif";
  ext: "png" | "jpg" | "gif";
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The source image could not be loaded. Try re-uploading it."));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function encode(c: HTMLCanvasElement, jpeg: boolean): Promise<Derivative> {
  const mime = jpeg ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve({ blob: b, mime, ext: jpeg ? "jpg" : "png" }) : reject(new Error("Couldn't encode the image."))),
      mime,
      jpeg ? 0.9 : undefined,
    ),
  );
}

function asset(id: string): string {
  const src = sourceUrl(id);
  if (!src) throw new Error("The original image is missing from this browser. Re-upload it.");
  return src;
}

async function svg(markup: string, w: number, h: number, crisp = false): Promise<Derivative> {
  const img = await load(svgDataUrl(markup));
  const { c, ctx } = canvas(w * DENSITY, h * DENSITY);
  if (crisp) ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return encode(c, false);
}

export async function derive(
  req: ImageRequest,
  mimeOf: (assetId: string) => string | undefined,
  metaOf: (assetId: string) => AssetMeta | undefined = () => undefined,
): Promise<Derivative> {
  switch (req.kind) {
    case "crop": {
      // Animated GIFs go out untouched when nothing needs baking in, so they keep moving.
      if (mimeOf(req.assetId) === "image/gif" && gifStillReason(metaOf(req.assetId), req) === null) {
        const blob = await (await fetch(asset(req.assetId))).blob();
        return { blob, mime: "image/gif", ext: "gif" };
      }
      const img = await load(asset(req.assetId));
      const { c, ctx } = canvas(req.w * DENSITY, req.h * DENSITY);
      ctx.beginPath();
      if (req.shape === "circle") ctx.ellipse(c.width / 2, c.height / 2, c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
      else if (req.shape === "rounded") ctx.roundRect(0, 0, c.width, c.height, req.radius * DENSITY);
      else ctx.rect(0, 0, c.width, c.height);
      ctx.clip();
      ctx.drawImage(img, req.rect.sx, req.rect.sy, req.rect.sw, req.rect.sh, 0, 0, c.width, c.height);
      return encode(c, req.shape === "square" && mimeOf(req.assetId) === "image/jpeg");
    }
    case "slice": {
      // Draw the whole card (with rounded corners) then cut the slice out, so
      // corners and edges line up perfectly between slices.
      const img = await load(asset(req.assetId));
      const full = canvas(req.cardW * DENSITY, req.cardH * DENSITY);
      full.ctx.beginPath();
      full.ctx.roundRect(0, 0, full.c.width, full.c.height, req.radius * DENSITY);
      full.ctx.clip();
      full.ctx.drawImage(img, 0, 0, full.c.width, full.c.height);
      const { c, ctx } = canvas(req.w * DENSITY, req.h * DENSITY);
      ctx.drawImage(full.c, req.x * DENSITY, req.y * DENSITY, c.width, c.height, 0, 0, c.width, c.height);
      // Photographic designs (JPEG exports) stay JPEG; PNG keeps text and transparency crisp.
      return encode(c, req.radius === 0 && mimeOf(req.assetId) === "image/jpeg");
    }
    case "video": {
      const img = await load(asset(req.assetId));
      const { c, ctx } = canvas(req.w * DENSITY, req.h * DENSITY);
      ctx.beginPath();
      ctx.roundRect(0, 0, c.width, c.height, 8 * DENSITY);
      ctx.clip();
      ctx.drawImage(img, req.rect.sx, req.rect.sy, req.rect.sw, req.rect.sh, 0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, c.width, c.height);
      const play = await load(svgDataUrl(glyphSvg("play", 44, "#ffffff")));
      const s = 44 * DENSITY;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(play, (c.width - s) / 2, (c.height - s) / 2, s, s);
      return encode(c, true);
    }
    case "social":
      return svg(socialSvg(req.platform, req.shape as never, req.size * DENSITY, req.color), req.size, req.size);
    case "glyph":
      if (!GLYPH_PATHS[req.name]) throw new Error(`Unknown icon ${req.name}`);
      return svg(glyphSvg(req.name, req.size * DENSITY, req.color, req.bg), req.size, req.size);
    case "badge": {
      const w = Math.round(req.height * 3.1);
      return svg(badgeSvg(req.store, req.height * DENSITY), w, req.height);
    }
    case "qr":
      return svg(qrSvg(req.value, req.size * DENSITY, req.color), req.size, req.size, true);
    case "script": {
      await document.fonts.load(`${req.size * DENSITY}px "${SCRIPT_FONT}"`);
      const w = estimateScriptWidth(req.text, req.size);
      const h = Math.round(req.size * 1.35);
      const { c, ctx } = canvas(w * DENSITY, h * DENSITY);
      let size = req.size * DENSITY;
      ctx.font = `${size}px "${SCRIPT_FONT}", cursive`;
      while (ctx.measureText(req.text).width > c.width - 4 && size > 8) {
        size -= 2;
        ctx.font = `${size}px "${SCRIPT_FONT}", cursive`;
      }
      ctx.fillStyle = req.color;
      ctx.textBaseline = "middle";
      ctx.fillText(req.text, 2, c.height / 2);
      return encode(c, false);
    }
  }
}
