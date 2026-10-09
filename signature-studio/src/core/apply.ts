import type { BrandKit, SignatureDoc } from "./types";
import { getTemplate } from "./templates";
import { blocksFromDoc } from "./blocks";

/**
 * Apply a template's layout and look. Content (details, images, social links,
 * add-ons, business card) is never touched. With keepColors the user's
 * accent/text colours survive the switch.
 */
export function applyTemplate(doc: SignatureDoc, templateId: string, opts: { keepColors?: boolean } = {}): void {
  const t = getTemplate(templateId);
  const keep = opts.keepColors ? { accent: doc.design.accent, text: doc.design.text, muted: doc.design.muted, surface: doc.design.surface } : {};
  doc.templateId = t.id;
  doc.design = { ...structuredClone(t.design), ...keep, width: doc.design.width };
  doc.images.photo.shape = t.photo.shape;
  doc.images.photo.size = t.photo.size;
  doc.images.logo.size = t.logo.size;
  // Block-made templates open in the builder; the others keep the current mode.
  if (t.blocks) {
    doc.mode = "builder";
    doc.blocks = blocksFromDoc(doc);
  } else if (doc.mode === "builder") doc.blocks = blocksFromDoc(doc);
}

/** Restyle a signature with a brand kit (colours, fonts, logo, company). */
export function applyBrand(doc: SignatureDoc, brand: BrandKit, opts: { fillEmpty?: boolean } = {}): void {
  Object.assign(doc.design, {
    accent: brand.accent,
    text: brand.text,
    muted: brand.muted,
    surface: brand.surface,
    headingFont: brand.headingFont,
    bodyFont: brand.bodyFont,
  });
  if (brand.textStyles?.length) {
    const have = new Set((doc.design.textStyles ?? []).map((t) => t.id));
    doc.design.textStyles = [...(doc.design.textStyles ?? []), ...brand.textStyles.filter((t) => !have.has(t.id)).map((t) => ({ ...t }))];
  }
  if (brand.logo && (!opts.fillEmpty || !doc.images.logo.assetId)) {
    doc.assets[brand.logo.id] = brand.logo;
    doc.images.logo.assetId = brand.logo.id;
  }
  if (opts.fillEmpty) {
    if (brand.company && !doc.details.company.trim()) doc.details.company = brand.company;
    if (brand.website && !doc.details.website.trim()) doc.details.website = brand.website;
  }
}
