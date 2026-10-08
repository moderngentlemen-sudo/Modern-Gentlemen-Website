/**
 * Sample content for template thumbnails, so every template is shown "full"
 * (photo, logo, socials) before the user adds anything of their own.
 * Sample images live only in the gallery; they never enter a saved signature.
 */
import { applyTemplate } from "../core/apply";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "../core/defaults";
import { getTemplate } from "../core/templates";
import type { SignatureDoc } from "../core/types";
import { svgDataUrl } from "../render/icons";
import { sourceUrl } from "../store/assets";

const PHOTO = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9c2ff"/><stop offset="1" stop-color="#ffc2dc"/></linearGradient></defs><rect width="400" height="400" fill="url(#b)"/><circle cx="200" cy="160" r="78" fill="#f1c9a5"/><path d="M122 140c0-60 40-88 82-88s76 30 74 86c-14-30-40-44-78-42-36 2-60 18-78 44z" fill="#3b2a24"/><path d="M60 400c8-92 66-138 140-138s132 46 140 138z" fill="#2f2a4a"/><path d="M168 262l32 40 32-40z" fill="#fff"/></svg>`,
);

const LOGO = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><rect x="0" y="40" width="120" height="120" rx="28" fill="#1d1b2c"/><path d="M30 130V70l30 36 30-36v60" stroke="#fff" stroke-width="12" fill="none" stroke-linejoin="round" stroke-linecap="round"/><text x="146" y="96" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#1d1b2c">MODERN</text><text x="146" y="146" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="300" fill="#1d1b2c">GENTLEMEN</text></svg>`,
);

const SAMPLE_SRC: Record<string, string> = { "sample-photo": PHOTO, "sample-logo": LOGO };

/** Object URL for a user asset, or a gallery sample image. */
export const previewSource = (id: string) => SAMPLE_SRC[id] ?? sourceUrl(id);

const cache = new Map<string, SignatureDoc>();

/** A fully populated example signature in the given template. */
export function sampleDoc(templateId: string, base?: SignatureDoc | null): SignatureDoc {
  const key = `${templateId}|${base?.id ?? ""}|${base?.updatedAt ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = getTemplate(templateId);
  const doc = newDoc(t.id, t.design, t.name);
  applyTemplate(doc, t.id);
  const own = base && base.details.name.trim();
  doc.details = own ? structuredClone(base.details) : { ...SAMPLE_DETAILS, custom: [] };
  doc.socials = own && base.socials.length ? structuredClone(base.socials) : SAMPLE_SOCIALS();
  if (own && base.images.photo.assetId && base.assets[base.images.photo.assetId]) {
    doc.assets[base.images.photo.assetId] = base.assets[base.images.photo.assetId];
    doc.images.photo = { ...doc.images.photo, assetId: base.images.photo.assetId, crop: base.images.photo.crop };
  } else {
    doc.assets["sample-photo"] = { id: "sample-photo", name: "photo", mime: "image/png", width: 400, height: 400, bytes: 0, hash: "sample-photo" };
    doc.images.photo.assetId = "sample-photo";
  }
  if (own && base.images.logo.assetId && base.assets[base.images.logo.assetId]) {
    doc.assets[base.images.logo.assetId] = base.assets[base.images.logo.assetId];
    doc.images.logo = { ...doc.images.logo, assetId: base.images.logo.assetId };
  } else {
    doc.assets["sample-logo"] = { id: "sample-logo", name: "logo", mime: "image/png", width: 600, height: 200, bytes: 0, hash: "sample-logo" };
    doc.images.logo.assetId = "sample-logo";
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, doc);
  return doc;
}
