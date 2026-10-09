import type { SignatureDoc } from "./types";
import { getTemplate } from "./templates";

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
}
