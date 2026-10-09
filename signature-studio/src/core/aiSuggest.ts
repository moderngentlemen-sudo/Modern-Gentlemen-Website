/**
 * AI design suggestions: what the app sends, and how it checks what comes back.
 *
 * The model chooses among Signet's own templates (so every suggestion is a
 * design that is known to render well in every inbox) and may personalise
 * the accent colour and fonts. It never sees contact details — only the job
 * title, company, which pieces exist (photo, logo, socials…) and the current
 * look. Everything it returns is validated here before anything is shown.
 */
import { applyTemplate } from "./apply";
import { FONTS } from "./fonts";
import { TEMPLATES } from "./templates";
import type { SignatureDoc } from "./types";

export interface SuggestRequest {
  role: string;
  company: string;
  has: { photo: boolean; logo: boolean; socials: number; website: boolean };
  current: { template: string; accent: string; headingFont: string; bodyFont: string };
  /** Optional words from the user ("bold", "law firm", "warmer"…), max 200 chars. */
  brief: string;
  templates: { id: string; name: string; group: string; category: string; description: string }[];
  fonts: { id: string; label: string; category: string; safe: boolean }[];
}

export interface Suggestion {
  templateId: string;
  title: string;
  why: string;
  accent?: string;
  headingFont?: string;
  bodyFont?: string;
}

export function buildRequest(doc: SignatureDoc, brief = ""): SuggestRequest {
  const d = doc.details;
  return {
    role: d.title.trim().slice(0, 80),
    company: d.company.trim().slice(0, 80),
    has: {
      photo: !!doc.images.photo.assetId,
      logo: !!doc.images.logo.assetId,
      socials: doc.socials.filter((s) => s.url.trim()).length,
      website: !!d.website.trim(),
    },
    current: { template: doc.templateId, accent: doc.design.accent, headingFont: doc.design.headingFont, bodyFont: doc.design.bodyFont },
    brief: brief.trim().slice(0, 200),
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, group: t.group, category: t.category, description: t.description })),
    fonts: FONTS.map((f) => ({ id: f.id, label: f.label, category: f.category, safe: f.safe })),
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clean = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Keep only well-formed suggestions that name real templates and fonts; at most three, no repeats. */
export function validateSuggestions(raw: unknown): Suggestion[] {
  const list = (raw as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];
  const templates = new Set(TEMPLATES.map((t) => t.id));
  const fonts = new Set(FONTS.map((f) => f.id));
  const out: Suggestion[] = [];
  for (const s of list as Record<string, unknown>[]) {
    const templateId = clean(s?.templateId, 60);
    if (!templates.has(templateId) || out.some((o) => o.templateId === templateId)) continue;
    out.push({
      templateId,
      title: clean(s.title, 60) || TEMPLATES.find((t) => t.id === templateId)!.name,
      why: clean(s.why, 240),
      accent: typeof s.accent === "string" && HEX.test(s.accent) ? s.accent.toLowerCase() : undefined,
      headingFont: typeof s.headingFont === "string" && fonts.has(s.headingFont) ? s.headingFont : undefined,
      bodyFont: typeof s.bodyFont === "string" && fonts.has(s.bodyFont) ? s.bodyFont : undefined,
    });
    if (out.length === 3) break;
  }
  return out;
}

/** Apply a suggestion: the template's design, then the personalised colour and fonts. */
export function applySuggestion(doc: SignatureDoc, s: Suggestion): void {
  applyTemplate(doc, s.templateId);
  if (s.accent) doc.design.accent = s.accent;
  if (s.headingFont) doc.design.headingFont = s.headingFont;
  if (s.bodyFont) doc.design.bodyFont = s.bodyFont;
}
