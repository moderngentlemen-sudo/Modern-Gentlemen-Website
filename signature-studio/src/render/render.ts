/**
 * Signature renderer: one pure function produces both the live preview and
 * the Gmail-ready HTML (tables + inline styles, no scripts, no <style>).
 *
 * preview: local images (object URLs / inline SVG), never sent anywhere.
 * email:   every image must resolve to a verified public URL, or it's an error.
 */
import { esc, escText } from "../lib/escape";
import { mailtoHref, normalizeWebUrl, safeHref, telHref, displayWebUrl } from "../lib/url";
import { cropRect } from "../core/crop";
import { fontStack } from "../core/fonts";
import { PLATFORM_MAP } from "../core/social";
import type { Hotspot, ImageShape, ImageSlot, SignatureDoc, Variant } from "../core/types";
import { getTemplate, type LayoutId } from "../core/templates";
import { badgeSvg, glyphSvg, qrSvg, socialSvg, svgDataUrl } from "./icons";

// ---------------------------------------------------------------------------
// Image requests
// ---------------------------------------------------------------------------

interface Base {
  key: string;
  label: string;
}

export type ImageRequest = Base &
  (
    | { kind: "crop"; assetId: string; w: number; h: number; rect: { sx: number; sy: number; sw: number; sh: number }; shape: ImageShape; radius: number }
    | { kind: "slice"; assetId: string; cardW: number; cardH: number; radius: number; x: number; y: number; w: number; h: number }
    | { kind: "video"; assetId: string; w: number; h: number; rect: { sx: number; sy: number; sw: number; sh: number } }
    | { kind: "social"; platform: string; shape: string; size: number; color: string }
    | { kind: "glyph"; name: string; size: number; color: string; bg?: string }
    | { kind: "badge"; store: "apple" | "google"; height: number }
    | { kind: "qr"; value: string; size: number; color: string }
    | { kind: "script"; text: string; color: string; size: number }
  );

export interface RenderOptions {
  variant: Variant;
  mode: "preview" | "email";
  /** email mode: verified public URL for a request. */
  resolve?: (req: ImageRequest) => string | null;
  /** preview mode: object URL for an uploaded asset. */
  sourceUrl?: (assetId: string) => string | null;
  /** Fallback-font preview ("as most inboxes show it"). */
  fallbackFonts?: boolean;
}

export interface RenderResult {
  html: string;
  images: ImageRequest[];
  errors: string[];
}

export const SCRIPT_FONT = "Great Vibes";

// ---------------------------------------------------------------------------
// Context & helpers
// ---------------------------------------------------------------------------

interface Ctx {
  doc: SignatureDoc;
  opts: RenderOptions;
  images: ImageRequest[];
  errors: string[];
  preview: boolean;
  compact: boolean;
  show: { photo: boolean; logo: boolean; social: boolean; addons: boolean; card: boolean };
}

const TABLE = 'cellpadding="0" cellspacing="0" border="0" role="presentation"';

function css(d: Record<string, string | number | undefined | false | null>): string {
  let s = "";
  for (const [k, v] of Object.entries(d)) if (v !== undefined && v !== false && v !== null && v !== "") s += `${k}:${v};`;
  return s;
}

function table(inner: string, style = "", attrs = ""): string {
  return `<table ${TABLE}${attrs ? " " + attrs : ""} style="border-collapse:collapse;${style}">${inner}</table>`;
}

const row = (cells: string) => `<tr>${cells}</tr>`;
const cell = (inner: string, style = "", attrs = "") => `<td${attrs ? " " + attrs : ""}${style ? ` style="${style}"` : ""}>${inner}</td>`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

function sp(c: Ctx, n: number): number {
  return Math.round(n * c.doc.design.spacing);
}

type FontRole = "heading" | "body";

function font(c: Ctx, role: FontRole): string {
  const id = role === "heading" ? c.doc.design.headingFont : c.doc.design.bodyFont;
  return fontStack(id, c.opts.fallbackFonts);
}

function text(
  c: Ctx,
  inner: string,
  o: {
    role?: FontRole;
    size?: number;
    weight?: number;
    color?: string;
    italic?: boolean;
    upper?: boolean;
    tracking?: number;
    lh?: number;
    align?: string;
    nowrap?: boolean;
  } = {},
): string {
  const size = o.size ?? c.doc.design.fontSize;
  return `<div style="${css({
    "font-family": font(c, o.role ?? "body"),
    "font-size": `${size}px`,
    "line-height": `${Math.round(size * (o.lh ?? 1.4))}px`,
    "font-weight": o.weight && o.weight !== 400 ? o.weight : undefined,
    "font-style": o.italic ? "italic" : undefined,
    "text-transform": o.upper ? "uppercase" : undefined,
    "letter-spacing": o.tracking ? `${o.tracking}em` : undefined,
    color: o.color ?? c.doc.design.text,
    "text-align": o.align,
    "white-space": o.nowrap ? "nowrap" : undefined,
  })}">${inner}</div>`;
}

function link(href: string | null, inner: string, color: string, underline = false): string {
  const safe = safeHref(href);
  if (!safe) return inner;
  return `<a href="${esc(safe)}" style="color:${esc(color)};text-decoration:${underline ? "underline" : "none"};">${inner}</a>`;
}

function imgTag(src: string, w: number, h: number, alt: string, extra = ""): string {
  return `<img src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;width:${w}px;height:${h}px;border:0;outline:none;text-decoration:none;${extra}">`;
}

/** Inline image (for icons sitting in a line of text). */
function inlineImg(src: string, w: number, h: number, alt: string): string {
  return `<img src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:inline-block;width:${w}px;height:${h}px;border:0;vertical-align:-2px;">`;
}

/** Resolve an image request to a src for the current mode. */
function source(c: Ctx, req: ImageRequest, previewSrc: () => string | null): string | null {
  c.images.push(req);
  if (c.preview) return previewSrc();
  const url = c.opts.resolve?.(req) ?? null;
  if (!url) c.errors.push(`${req.label} isn't published yet.`);
  return url;
}

// ---------------------------------------------------------------------------
// Links derived from details
// ---------------------------------------------------------------------------

export function websiteHref(v: string): string | null {
  return v.trim() ? normalizeWebUrl(v) : null;
}

function socialUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function hotspotHref(doc: SignatureDoc, h: Hotspot, digitalUrl: string | null): string | null {
  const d = doc.details;
  switch (h.action) {
    case "website":
      return websiteHref(d.website);
    case "email":
      return mailtoHref(d.email);
    case "phone":
      return telHref(d.phone);
    case "mobile":
      return telHref(d.mobile);
    case "meeting":
      return doc.addons.meeting.url ? normalizeWebUrl(doc.addons.meeting.url) : null;
    case "digital-card":
      return digitalUrl;
    case "url":
      return h.url ? normalizeWebUrl(h.url) : null;
    default: {
      const s = doc.socials.find((x) => x.platform === h.action && x.url.trim());
      return s ? socialUrl(s.url) : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function nameHtml(c: Ctx, o: { size?: number; color?: string; align?: string; upper?: boolean } = {}): string {
  const d = c.doc.details;
  const design = c.doc.design;
  const value = d.name.trim() || (c.preview ? "Your Name" : "");
  if (!value) return "";
  const size = o.size ?? Math.round(design.fontSize * design.nameScale);
  const pron = d.pronouns.trim()
    ? ` <span style="font-size:${design.fontSize - 1}px;font-weight:400;color:${esc(design.muted)};">(${esc(d.pronouns)})</span>`
    : "";
  return text(c, `${esc(value)}${pron}`, {
    role: "heading",
    size,
    weight: 700,
    color: o.color ?? design.text,
    lh: 1.2,
    align: o.align,
    upper: o.upper ?? design.nameCase === "upper",
    tracking: (o.upper ?? design.nameCase === "upper") ? 0.06 : undefined,
  });
}

function titleHtml(c: Ctx, o: { color?: string; align?: string; separate?: boolean; upper?: boolean } = {}): string {
  const d = c.doc.details;
  const parts = [d.title, d.department, d.company].map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return "";
  const color = o.color ?? c.doc.design.muted;
  return text(c, parts.map(esc).join(` <span style="color:${esc(mix(color, "#ffffff", 0.4))};">|</span> `), {
    color,
    align: o.align,
    upper: o.upper,
    tracking: o.upper ? 0.08 : undefined,
    size: o.upper ? c.doc.design.fontSize - 2 : undefined,
  });
}

interface ContactItem {
  glyph: string;
  letter: string;
  word: string;
  text: string;
  href: string | null;
}

function contactItems(c: Ctx): ContactItem[] {
  const d = c.doc.details;
  const items: ContactItem[] = [];
  if (d.phone.trim()) items.push({ glyph: "phone", letter: "T", word: "Phone", text: d.phone.trim(), href: telHref(d.phone) });
  if (d.mobile.trim()) items.push({ glyph: "mobile", letter: "M", word: "Mobile", text: d.mobile.trim(), href: telHref(d.mobile) });
  if (d.email.trim()) items.push({ glyph: "email", letter: "E", word: "Email", text: d.email.trim(), href: mailtoHref(d.email) });
  if (d.website.trim()) items.push({ glyph: "website", letter: "W", word: "Web", text: displayWebUrl(d.website), href: websiteHref(d.website) });
  if (d.address.trim() && !c.compact) items.push({ glyph: "address", letter: "A", word: "Address", text: d.address.trim(), href: null });
  if (!c.compact)
    for (const cf of d.custom)
      if (cf.value.trim())
        items.push({
          glyph: "website",
          letter: cf.label.slice(0, 1).toUpperCase(),
          word: cf.label,
          text: cf.value,
          href: cf.link ? safeHref(normalizeWebUrl(cf.link)) : null,
        });
  return items;
}

function glyphImg(c: Ctx, name: string, size: number, color: string, bg?: string): string {
  const req: ImageRequest = { kind: "glyph", key: `glyph|${name}|${size}|${color}|${bg ?? ""}`, label: `${name} icon`, name, size, color, bg };
  const src = source(c, req, () => svgDataUrl(glyphSvg(name, size, color, bg)));
  return src ?? "";
}

function contactsHtml(c: Ctx, o: { inline?: boolean; align?: string; iconBg?: boolean; color?: string } = {}): string {
  const items = contactItems(c);
  if (!items.length) return "";
  const design = c.doc.design;
  const mode = design.contactIcons;
  const color = o.color ?? design.text;
  const iconSize = Math.max(12, design.fontSize);
  const label = (it: ContactItem) => {
    if (mode === "icons") {
      const src = o.iconBg ? glyphImg(c, it.glyph, iconSize + 6, "#ffffff", design.accent) : glyphImg(c, it.glyph, iconSize, design.accent);
      const s = o.iconBg ? iconSize + 6 : iconSize;
      return src ? `${inlineImg(src, s, s, it.word)}&nbsp;&nbsp;` : "";
    }
    if (mode === "letters") return `<span style="color:${esc(design.accent)};font-weight:700;">${esc(it.letter)}</span>&nbsp;&nbsp;`;
    if (mode === "words") return `<span style="color:${esc(design.accent)};font-weight:600;">${esc(it.word)}</span>&nbsp;&nbsp;`;
    return "";
  };
  const value = (it: ContactItem) => link(it.href, escText(it.text), color);
  if (o.inline ?? design.contactInline) {
    const sep = `&nbsp;&nbsp;<span style="color:${esc(mix(design.muted, "#ffffff", 0.45))};">|</span>&nbsp;&nbsp;`;
    return text(c, items.map((it) => `<span style="white-space:nowrap;">${label(it)}${value(it)}</span>`).join(sep), { align: o.align, color });
  }
  const gap = sp(c, 3);
  return table(
    items.map((it, i) => row(cell(text(c, `${label(it)}${value(it)}`, { color, nowrap: true }), i ? `padding-top:${gap}px;` : ""))).join(""),
    "",
    o.align === "center" ? 'align="center"' : "",
  );
}

function socialsHtml(c: Ctx, o: { align?: string; size?: number } = {}): string {
  if (!c.show.social) return "";
  const links = c.doc.socials.filter((s) => s.url.trim());
  if (!links.length) return "";
  const st = c.doc.design.social;
  const size = o.size ?? st.size;
  const cells = links.map((s, i) => {
    const def = PLATFORM_MAP[s.platform];
    const color = st.colorMode === "brand" ? def.brand : st.colorMode === "accent" ? c.doc.design.accent : c.doc.design.text;
    const req: ImageRequest = {
      kind: "social",
      key: `social|${s.platform}|${st.shape}|${size}|${color}`,
      label: `${def.label} icon`,
      platform: s.platform,
      shape: st.shape,
      size,
      color,
    };
    const src = source(c, req, () => svgDataUrl(socialSvg(s.platform, st.shape, size, color)));
    if (!src) return "";
    const pad = i < links.length - 1 ? `padding-right:${st.gap}px;` : "";
    return cell(link(socialUrl(s.url), imgTag(src, size, size, def.label), c.doc.design.accent), pad);
  });
  return table(row(cells.join("")), "", o.align === "center" ? 'align="center"' : "");
}

function slotImage(c: Ctx, slot: ImageSlot, label: string, o: { size?: number } = {}): string {
  if (!slot.assetId) return "";
  const meta = c.doc.assets[slot.assetId];
  if (!meta) return "";
  const w = o.size ?? slot.size;
  const square = slot.shape === "circle" || label === "Photo";
  const aspect = square ? 1 : meta.width / meta.height;
  const h = Math.max(1, Math.round(w / aspect));
  const rect = cropRect(meta.width, meta.height, aspect, slot.crop);
  const radius = slot.shape === "rounded" ? Math.round(w * 0.12) : 0;
  const req: ImageRequest = {
    kind: "crop",
    key: `crop|${meta.hash}|${w}x${h}|${rect.sx.toFixed(1)},${rect.sy.toFixed(1)},${rect.sw.toFixed(1)}|${slot.shape}`,
    label,
    assetId: slot.assetId,
    w,
    h,
    rect,
    shape: slot.shape,
    radius,
  };
  let html: string;
  if (c.preview) {
    c.images.push(req);
    const src = c.opts.sourceUrl?.(slot.assetId) ?? "";
    const k = w / rect.sw;
    const br = slot.shape === "circle" ? "50%" : `${radius}px`;
    html = `<div style="width:${w}px;height:${h}px;overflow:hidden;position:relative;border-radius:${br};"><img src="${esc(src)}" alt="${esc(label)}" style="position:absolute;max-width:none;left:${(-rect.sx * k).toFixed(1)}px;top:${(-rect.sy * k).toFixed(1)}px;width:${(meta.width * k).toFixed(1)}px;height:${(meta.height * k).toFixed(1)}px;"></div>`;
  } else {
    const src = source(c, req, () => null);
    if (!src) return "";
    html = imgTag(src, w, h, label);
  }
  return slot.link ? link(normalizeWebUrl(slot.link), html, c.doc.design.accent) : html;
}

function photoHtml(c: Ctx, size?: number): string {
  return c.show.photo ? slotImage(c, c.doc.images.photo, "Photo", { size }) : "";
}

function logoHtml(c: Ctx, size?: number): string {
  return c.show.logo ? slotImage(c, c.doc.images.logo, `${c.doc.details.company || "Company"} logo`, { size }) : "";
}

function hRule(c: Ctx, width?: number): string {
  const d = c.doc.design;
  if (d.divider === "none") return "";
  const color = d.divider === "accent" ? d.accent : mix(d.muted, "#ffffff", 0.6);
  const weight = d.divider === "accent" ? 2 : 1;
  const style = d.divider === "dots" ? "dotted" : "solid";
  const w = width ? `width="${width}"` : 'width="100%"';
  return table(
    row(cell("&nbsp;", `border-top:${weight}px ${style} ${color};font-size:1px;line-height:1px;height:1px;`)),
    width ? `width:${width}px;` : "width:100%;",
    w,
  );
}

function vRule(c: Ctx): { cells: (left: string, right: string) => string } {
  const d = c.doc.design;
  const gap = sp(c, 16);
  return {
    cells: (left, right) => {
      if (d.divider === "none") return `${left}${cell("&nbsp;", `width:${gap}px;font-size:1px;`, `width="${gap}"`)}${right}`;
      const color = d.divider === "accent" ? d.accent : mix(d.muted, "#ffffff", 0.6);
      const weight = d.divider === "accent" ? 2 : 1;
      const style = d.divider === "dots" ? "dotted" : "solid";
      return `${left}${cell("&nbsp;", `width:${Math.round(gap / 2)}px;font-size:1px;`)}${cell("&nbsp;", `border-left:${weight}px ${style} ${color};font-size:1px;`)}${cell("&nbsp;", `width:${Math.round(gap / 2)}px;font-size:1px;`)}${right}`;
    },
  };
}

/** Vertical stack of non-empty blocks with even gaps. */
function stack(c: Ctx, blocks: string[], gap = 6, align?: string): string {
  const items = blocks.filter(Boolean);
  if (!items.length) return "";
  const g = sp(c, gap);
  return table(
    items
      .map((b, i) =>
        row(
          cell(
            align === "center" && b.startsWith("<table ") && !b.startsWith("<table align") ? b.replace("<table ", '<table align="center" ') : b,
            css({ "padding-top": i ? `${g}px` : undefined, "text-align": align }),
            align ? `align="${align}"` : "",
          ),
        ),
      )
      .join(""),
    "",
    align === "center" ? 'align="center"' : "",
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase())
      .slice(0, 2)
      .join("") || "YN"
  );
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

type Layout = (c: Ctx) => string;

const L: Record<LayoutId, Layout> = {
  classic: (c) => {
    const left = photoHtml(c) || logoHtml(c);
    const right = stack(
      c,
      [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), left && photoHtml(c) ? logoHtml(c, Math.min(c.doc.images.logo.size, 90)) : ""],
      6,
    );
    if (!left) return right;
    return table(row(vRule(c).cells(cell(left, "vertical-align:top;"), cell(right, "vertical-align:top;"))));
  },
  stacked: (c) => stack(c, [photoHtml(c), stack(c, [nameHtml(c), titleHtml(c)], 2), hRule(c, 260), contactsHtml(c), socialsHtml(c), logoHtml(c)], 8),
  centered: (c) =>
    stack(
      c,
      [
        photoHtml(c) || logoHtml(c),
        stack(c, [nameHtml(c, { align: "center" }), titleHtml(c, { align: "center" })], 2, "center"),
        hRule(c, 60),
        contactsHtml(c, { inline: true, align: "center" }),
        socialsHtml(c, { align: "center" }),
        photoHtml(c) ? logoHtml(c, 90) : "",
      ],
      8,
      "center",
    ),
  banner: (c) => {
    const d = c.doc.design;
    const pad = sp(c, 14);
    const band = table(
      row(
        cell(
          stack(c, [nameHtml(c, { color: "#ffffff" }), titleHtml(c, { color: mix(d.accent, "#ffffff", 0.75) })], 2),
          `background-color:${d.accent};padding:${pad}px ${pad + 4}px;border-radius:8px 8px 0 0;`,
          `bgcolor="${esc(d.accent)}"`,
        ),
      ),
      "width:100%;",
      'width="100%"',
    );
    const body = table(
      row(
        (photoHtml(c, 64) ? cell(photoHtml(c, 64), `vertical-align:top;padding-right:${sp(c, 14)}px;`) : "") +
          cell(stack(c, [contactsHtml(c), socialsHtml(c)], 8), "vertical-align:top;") +
          (logoHtml(c) ? cell(logoHtml(c, 90), `vertical-align:top;padding-left:${sp(c, 14)}px;`, 'align="right"') : ""),
      ),
    );
    return table(
      row(cell(band)) +
        row(cell(body, `padding:${pad}px ${pad + 4}px;border:1px solid ${mix(d.accent, "#ffffff", 0.82)};border-top:0;border-radius:0 0 8px 8px;`)),
      `width:${Math.min(d.width, 460)}px;`,
      `width="${Math.min(d.width, 460)}"`,
    );
  },
  sidebar: (c) => {
    const d = c.doc.design;
    const details = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), logoHtml(c, 90)], 6);
    const bar = cell("&nbsp;", `width:4px;background-color:${d.accent};font-size:1px;border-radius:2px;`, `width="4" bgcolor="${esc(d.accent)}"`);
    const photo = photoHtml(c);
    return table(
      row(
        (photo ? cell(photo, `vertical-align:top;padding-right:${sp(c, 14)}px;`) : "") + bar + cell(details, `vertical-align:top;padding-left:${sp(c, 14)}px;`),
      ),
    );
  },
  card: (c) => {
    const d = c.doc.design;
    const pad = sp(c, 18);
    const photo = photoHtml(c);
    const inner = table(
      row(
        (photo ? cell(photo, `vertical-align:middle;padding-right:${sp(c, 16)}px;`) : "") +
          cell(stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c)], 6), "vertical-align:middle;"),
      ),
    );
    const logo = logoHtml(c, 80);
    return table(
      row(cell(stack(c, [inner, logo], 12), `background-color:${d.surface};padding:${pad}px ${pad + 4}px;border-radius:14px;`, `bgcolor="${esc(d.surface)}"`)),
    );
  },
  split3: (c) => {
    const photo = photoHtml(c);
    const mid = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c)], 6);
    const right = stack(c, [logoHtml(c, 90), socialsHtml(c)], 10);
    let cells = (photo ? cell(photo, `vertical-align:middle;padding-right:${sp(c, 14)}px;`) : "") + cell(mid, "vertical-align:middle;");
    if (right) cells = vRule(c).cells(cells, cell(right, "vertical-align:middle;"));
    return table(row(cells));
  },
  compact: (c) => {
    const d = c.doc.design;
    const head = [nameHtml(c, { size: Math.round(d.fontSize * 1.1) }), titleHtml(c)].filter(Boolean);
    const line = table(row(head.map((h, i) => cell(h, i ? `padding-left:${sp(c, 10)}px;vertical-align:bottom;` : "vertical-align:bottom;")).join("")));
    const photo = photoHtml(c, 44);
    const logo = logoHtml(c, 64);
    const body = stack(c, [line, contactsHtml(c, { inline: true }), socialsHtml(c, { size: 16 })], 4);
    const img = photo || logo;
    return img ? table(row(cell(img, `vertical-align:middle;padding-right:${sp(c, 12)}px;`) + cell(body, "vertical-align:middle;"))) : body;
  },
  editorial: (c) => {
    const d = c.doc.design;
    const company =
      d && c.doc.details.company.trim()
        ? text(c, esc(c.doc.details.company), { size: d.fontSize - 3, upper: true, tracking: 0.28, color: d.accent, weight: 600 })
        : "";
    const name = nameHtml(c, { size: Math.round(d.fontSize * d.nameScale * 1.35) });
    const title = c.doc.details.title.trim() ? text(c, esc(c.doc.details.title), { italic: true, color: d.muted, role: "heading", size: d.fontSize + 1 }) : "";
    return stack(c, [company, name, title, hRule(c, 320), contactsHtml(c, { inline: true }), socialsHtml(c), logoHtml(c, 90)], 6);
  },
  monogram: (c) => {
    const d = c.doc.design;
    const size = Math.round(64 * d.spacing);
    const tile = table(
      row(
        cell(
          text(c, esc(initials(c.doc.details.name)), { role: "heading", size: Math.round(size * 0.38), weight: 700, color: "#ffffff", align: "center", lh: 1 }),
          `width:${size}px;height:${size}px;background-color:${d.accent};border-radius:${Math.round(size / 2)}px;text-align:center;vertical-align:middle;`,
          `width="${size}" height="${size}" bgcolor="${esc(d.accent)}" align="center" valign="middle"`,
        ),
      ),
    );
    const left = photoHtml(c) || tile;
    return table(
      row(
        cell(left, `vertical-align:top;padding-right:${sp(c, 16)}px;`) +
          cell(stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), logoHtml(c, 90)], 6), "vertical-align:top;"),
      ),
    );
  },
  photoRight: (c) => {
    const right = photoHtml(c) || logoHtml(c);
    const left = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), photoHtml(c) ? logoHtml(c, 90) : ""], 6);
    if (!right) return left;
    return table(row(vRule(c).cells(cell(left, "vertical-align:top;"), cell(right, "vertical-align:top;"))));
  },
  grid: (c) => {
    const items = contactItems(c);
    const d = c.doc.design;
    const gridRows: string[] = [];
    // Two contacts per row (reuse contactsHtml styling by rendering each item alone).
    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2).map((it) => {
        const icon = d.contactIcons === "icons" ? glyphImg(c, it.glyph, d.fontSize, d.accent) : "";
        const lab = icon
          ? `${inlineImg(icon, d.fontSize, d.fontSize, it.word)}&nbsp;&nbsp;`
          : d.contactIcons === "none"
            ? ""
            : `<span style="color:${esc(d.accent)};font-weight:700;">${esc(d.contactIcons === "words" ? it.word : it.letter)}</span>&nbsp;&nbsp;`;
        return cell(
          text(c, `${lab}${link(it.href, escText(it.text), d.text)}`, { nowrap: true }),
          `padding:${i ? sp(c, 4) : 0}px ${sp(c, 18)}px 0 0;vertical-align:top;`,
        );
      });
      gridRows.push(row(pair.join("") + (pair.length < 2 ? cell("") : "")));
    }
    const grid = gridRows.length ? table(gridRows.join("")) : "";
    const main = stack(c, [stack(c, [nameHtml(c), titleHtml(c)], 2), hRule(c), grid, socialsHtml(c)], 8);
    const side = photoHtml(c) || logoHtml(c);
    return side ? table(row(cell(main, "vertical-align:top;") + cell(side, `vertical-align:top;padding-left:${sp(c, 18)}px;`))) : main;
  },
  bold: (c) => {
    const d = c.doc.design;
    const name = table(
      row(cell(nameHtml(c, { size: Math.round(d.fontSize * d.nameScale * 1.25) }), `border-bottom:4px solid ${d.accent};padding-bottom:${sp(c, 4)}px;`)),
    );
    const body = stack(c, [name, titleHtml(c, { upper: true }), contactsHtml(c, { iconBg: true }), socialsHtml(c)], 8);
    const side = photoHtml(c) || logoHtml(c);
    return side ? table(row(cell(side, `vertical-align:top;padding-right:${sp(c, 18)}px;`) + cell(body, "vertical-align:top;"))) : body;
  },
  chips: (c) => {
    const d = c.doc.design;
    const items = contactItems(c);
    const chip = (it: ContactItem) => {
      const icon = d.contactIcons === "icons" ? glyphImg(c, it.glyph, d.fontSize - 1, d.accent) : "";
      const lab = icon ? `${inlineImg(icon, d.fontSize - 1, d.fontSize - 1, it.word)}&nbsp;` : "";
      return table(
        row(
          cell(
            text(c, `${lab}${link(it.href, escText(it.text), d.text)}`, { size: d.fontSize - 1, nowrap: true }),
            `background-color:${d.surface};padding:${sp(c, 4)}px ${sp(c, 10)}px;border-radius:14px;`,
            `bgcolor="${esc(d.surface)}"`,
          ),
        ),
      );
    };
    const rows: string[] = [];
    for (let i = 0; i < items.length; i += 2)
      rows.push(
        row(
          items
            .slice(i, i + 2)
            .map((it) => cell(chip(it), `padding:0 ${sp(c, 6)}px ${sp(c, 6)}px 0;`))
            .join(""),
        ),
      );
    const top = table(
      row(
        (logoHtml(c, 56) ? cell(logoHtml(c, 56), `vertical-align:middle;padding-right:${sp(c, 12)}px;`) : "") +
          cell(stack(c, [nameHtml(c), titleHtml(c)], 2), "vertical-align:middle;"),
      ),
    );
    return stack(c, [photoHtml(c), top, rows.length ? table(rows.join("")) : "", socialsHtml(c)], 10);
  },
};

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

function button(c: Ctx, label: string, href: string | null, style: "solid" | "outline" | "pill" | "link", iconName?: string): string {
  const d = c.doc.design;
  const safe = safeHref(href);
  if (!safe) {
    if (c.preview) c.errors.push(`"${label}" has no link.`);
    if (!c.preview) return "";
  }
  if (style === "link") return text(c, link(safe, `${esc(label)}&nbsp;&rarr;`, d.accent), { weight: 600, color: d.accent });
  const solid = style !== "outline";
  const icon = iconName ? glyphImg(c, iconName, d.fontSize, solid ? "#ffffff" : d.accent) : "";
  const inner = `${icon ? `${inlineImg(icon, d.fontSize, d.fontSize, "")}&nbsp;&nbsp;` : ""}${esc(label)}`;
  const color = solid ? "#ffffff" : d.accent;
  const a = safe ? `<a href="${esc(safe)}" style="color:${color};text-decoration:none;display:inline-block;">${inner}</a>` : inner;
  return table(
    row(
      cell(
        text(c, a, { weight: 600, color, size: d.fontSize, nowrap: true }),
        css({
          "background-color": solid ? d.accent : undefined,
          border: solid ? undefined : `1.5px solid ${d.accent}`,
          "border-radius": style === "pill" ? "999px" : "6px",
          padding: `${sp(c, 8)}px ${sp(c, 16)}px`,
        }),
        solid ? `bgcolor="${esc(d.accent)}"` : "",
      ),
    ),
    "border-collapse:separate;",
  );
}

function addonsTop(c: Ctx): string {
  const s = c.doc.addons.signOff;
  if (!c.show.addons || !s.enabled || !s.text.trim()) return "";
  const d = c.doc.design;
  if (!s.script) return text(c, escText(s.text), { color: d.text });
  const size = Math.round(d.fontSize * 2.1);
  const req: ImageRequest = { kind: "script", key: `script|${s.text}|${d.text}|${size}`, label: "Sign-off", text: s.text, color: d.text, size };
  if (c.preview) {
    c.images.push(req);
    return `<div style="font-family:'${SCRIPT_FONT}',cursive;font-size:${size}px;line-height:${Math.round(size * 1.15)}px;color:${esc(d.text)};">${escText(s.text)}</div>`;
  }
  const src = source(c, req, () => null);
  if (!src) return "";
  // Approximate width: the derivative reports exact size; keep aspect via height only.
  const w = estimateScriptWidth(s.text, size);
  return imgTag(src, w, Math.round(size * 1.35), s.text);
}

export function estimateScriptWidth(text: string, size: number): number {
  return Math.max(40, Math.round(text.length * size * 0.42 + size * 0.4));
}

function addonsBottom(c: Ctx, digitalUrl: string | null): string[] {
  if (!c.show.addons) return [];
  const a = c.doc.addons;
  const d = c.doc.design;
  const out: string[] = [];
  const buttons: string[] = [];
  if (a.cta.enabled && a.cta.text.trim())
    buttons.push(button(c, a.cta.text, a.cta.url ? normalizeWebUrl(a.cta.url) : websiteHref(c.doc.details.website), a.cta.style));
  if (a.meeting.enabled && a.meeting.text.trim())
    buttons.push(button(c, a.meeting.text, a.meeting.url ? normalizeWebUrl(a.meeting.url) : null, "outline", "calendar"));
  if (buttons.filter(Boolean).length)
    out.push(
      table(
        row(
          buttons
            .filter(Boolean)
            .map((b, i) => cell(b, i ? `padding-left:${sp(c, 8)}px;` : ""))
            .join(""),
        ),
      ),
    );
  if (a.quote.enabled && a.quote.text.trim()) {
    out.push(
      table(
        row(
          cell(
            text(c, `&ldquo;${escText(a.quote.text)}&rdquo;`, { italic: true, color: d.text, role: "heading" }) +
              (a.quote.author.trim() ? text(c, `&mdash; ${esc(a.quote.author)}`, { size: d.fontSize - 2, color: d.muted }) : ""),
            `border-left:3px solid ${d.accent};padding-left:${sp(c, 10)}px;`,
          ),
        ),
      ),
    );
  }
  if (a.reviews.enabled) {
    const n = Math.max(0, Math.min(5, Math.round(a.reviews.rating)));
    const stars = Array.from({ length: 5 }, (_, i) => {
      const src = glyphImg(c, "star", 15, i < n ? "#f5a623" : mix(d.muted, "#ffffff", 0.6));
      return src ? cell(imgTag(src, 15, 15, i < n ? "★" : "☆"), "padding-right:2px;") : "";
    }).join("");
    const label = a.reviews.text.trim()
      ? cell(
          text(c, link(a.reviews.url ? normalizeWebUrl(a.reviews.url) : null, esc(a.reviews.text), d.accent), { size: d.fontSize - 1, weight: 600 }),
          `padding-left:${sp(c, 8)}px;vertical-align:middle;`,
        )
      : "";
    out.push(table(row(stars + label)));
  }
  if (a.video.enabled && a.video.assetId && c.doc.assets[a.video.assetId]) {
    const meta = c.doc.assets[a.video.assetId];
    const w = 240;
    const h = 135;
    const rect = cropRect(meta.width, meta.height, w / h, { x: 0, y: 0, zoom: 1 });
    const req: ImageRequest = { kind: "video", key: `video|${meta.hash}|${w}x${h}`, label: "Video thumbnail", assetId: a.video.assetId, w, h, rect };
    let thumb: string;
    if (c.preview) {
      c.images.push(req);
      const src = c.opts.sourceUrl?.(a.video.assetId) ?? "";
      const play = svgDataUrl(glyphSvg("play", 44, "#ffffff"));
      thumb = `<div style="width:${w}px;height:${h}px;position:relative;border-radius:8px;overflow:hidden;background:url('${esc(src)}') center/cover;"><img src="${play}" width="44" height="44" alt="" style="position:absolute;left:${(w - 44) / 2}px;top:${(h - 44) / 2}px;opacity:.92;"></div>`;
    } else {
      const src = source(c, req, () => null);
      thumb = src ? imgTag(src, w, h, a.video.title || "Video") : "";
    }
    if (thumb)
      out.push(
        stack(
          c,
          [
            link(a.video.url ? normalizeWebUrl(a.video.url) : null, thumb, d.accent),
            a.video.title.trim()
              ? text(c, link(a.video.url ? normalizeWebUrl(a.video.url) : null, `&#9654;&nbsp;${esc(a.video.title)}`, d.accent), {
                  size: d.fontSize - 1,
                  weight: 600,
                })
              : "",
          ],
          4,
        ),
      );
  }
  if (a.apps.enabled && (a.apps.appStore.trim() || a.apps.googlePlay.trim())) {
    const cells: string[] = [];
    for (const [store, url] of [
      ["apple", a.apps.appStore],
      ["google", a.apps.googlePlay],
    ] as const) {
      if (!url.trim()) continue;
      const height = 34;
      const req: ImageRequest = {
        kind: "badge",
        key: `badge|${store}|${height}`,
        label: store === "apple" ? "App Store badge" : "Google Play badge",
        store,
        height,
      };
      const src = source(c, req, () => svgDataUrl(badgeSvg(store, height)));
      if (src) cells.push(cell(link(normalizeWebUrl(url), imgTag(src, Math.round(height * 3.1), height, req.label), d.accent), "padding-right:8px;"));
    }
    if (cells.length) out.push(table(row(cells.join(""))));
  }
  if (a.banner.enabled && a.banner.assetId && c.doc.assets[a.banner.assetId]) {
    const slot: ImageSlot = {
      assetId: a.banner.assetId,
      size: Math.min(a.banner.width, d.width),
      shape: "rounded",
      crop: { x: 0, y: 0, zoom: 1 },
      link: a.banner.url || undefined,
    };
    out.push(slotImage(c, slot, a.banner.alt || "Banner"));
  }
  if (c.doc.card.enabled && c.doc.card.digitalLink && c.doc.card.assetId && c.show.card) {
    const url = digitalUrl ?? (c.preview ? "https://example.com/card" : null);
    if (url) {
      const qrReq: ImageRequest = { kind: "qr", key: `qr|${url}|64|${d.text}`, label: "Digital card QR code", value: url, size: 64, color: d.text };
      const qr = source(c, qrReq, () => svgDataUrl(qrSvg(url, 64, d.text)));
      out.push(
        table(
          row(
            (qr
              ? cell(link(url, imgTag(qr, 64, 64, "QR code to my digital business card"), d.accent), `padding-right:${sp(c, 10)}px;vertical-align:middle;`)
              : "") +
              cell(
                text(c, link(url, "View my digital business card&nbsp;&rarr;", d.accent), { weight: 600, color: d.accent }) +
                  text(c, "Save my contact in one tap", { size: d.fontSize - 2, color: d.muted }),
                "vertical-align:middle;",
              ),
          ),
        ),
      );
    }
  }
  if (a.disclaimer.enabled && a.disclaimer.text.trim())
    out.push(
      `<div style="max-width:${Math.min(d.width, 520)}px;">${text(c, escText(a.disclaimer.text), { size: Math.max(9, d.fontSize - 3), color: d.muted, lh: 1.45 })}</div>`,
    );
  if (a.green.enabled && a.green.text.trim())
    out.push(text(c, `&#127807;&nbsp;${escText(a.green.text)}`, { size: Math.max(9, d.fontSize - 3), color: "#3f8f4f" }));
  return out;
}

// ---------------------------------------------------------------------------
// Business card (e.g. a Canva design) — sliced into linked image cells
// ---------------------------------------------------------------------------

export interface Slice {
  x: number;
  y: number;
  w: number;
  h: number;
  href: string | null;
}

/**
 * Cut the card into horizontal bands at hotspot edges; inside each band cut
 * only at the edges of hotspots that overlap it. Adjacent cells with the same
 * link are merged. Coordinates are in display px and always sum exactly.
 */
export function sliceCard(width: number, height: number, hotspots: { x: number; y: number; w: number; h: number; href: string | null }[]): Slice[][] {
  const px = (f: number, total: number) => Math.max(0, Math.min(total, Math.round(f * total)));
  const spots = hotspots
    .map((h) => ({ x0: px(h.x, width), x1: px(h.x + h.w, width), y0: px(h.y, height), y1: px(h.y + h.h, height), href: h.href }))
    .filter((h) => h.x1 > h.x0 && h.y1 > h.y0);
  const ys = [...new Set([0, height, ...spots.flatMap((s) => [s.y0, s.y1])])].sort((a, b) => a - b);
  const bands: Slice[][] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (y1 <= y0) continue;
    const inBand = spots.filter((s) => s.y0 < y1 && s.y1 > y0);
    const xs = [...new Set([0, width, ...inBand.flatMap((s) => [s.x0, s.x1])])].sort((a, b) => a - b);
    const cells: Slice[] = [];
    for (let j = 0; j < xs.length - 1; j++) {
      const x0 = xs[j];
      const x1 = xs[j + 1];
      if (x1 <= x0) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const hit = inBand.find((s) => cx >= s.x0 && cx < s.x1 && cy >= s.y0 && cy < s.y1);
      const href = hit?.href ?? null;
      const prev = cells[cells.length - 1];
      if (prev && prev.href === href) prev.w += x1 - x0;
      else cells.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, href });
    }
    bands.push(cells);
  }
  return bands;
}

function cardHtml(c: Ctx, digitalUrl: string | null): string {
  const card = c.doc.card;
  if (!card.enabled || !card.assetId || !c.show.card) return "";
  const meta = c.doc.assets[card.assetId];
  if (!meta) return "";
  // A Canva signature keeps its own size; a card fits the signature width.
  const width = card.kind === "signature" ? card.width : Math.min(card.width, c.doc.design.width);
  const height = Math.round((width * meta.height) / meta.width);
  const spots = card.hotspots.map((h) => ({ ...h, href: safeHref(hotspotHref(c.doc, h, digitalUrl)) }));
  if (c.preview) {
    const src = c.opts.sourceUrl?.(card.assetId) ?? "";
    // Requests still recorded so readiness can list them.
    for (const band of sliceCard(width, height, spots))
      for (const s of band)
        c.images.push({
          kind: "slice",
          key: `slice|${meta.hash}|${width}|${card.radius}|${s.x},${s.y},${s.w},${s.h}`,
          label: "Business card",
          assetId: card.assetId,
          cardW: width,
          cardH: height,
          radius: card.radius,
          ...s,
        });
    const overlays = spots
      .filter((s) => s.href)
      .map(
        (s) =>
          `<a href="${esc(s.href!)}" title="${esc(s.label)}" style="position:absolute;left:${(s.x * 100).toFixed(2)}%;top:${(s.y * 100).toFixed(2)}%;width:${(s.w * 100).toFixed(2)}%;height:${(s.h * 100).toFixed(2)}%;"></a>`,
      )
      .join("");
    return `<div style="position:relative;width:${width}px;height:${height}px;"><img src="${esc(src)}" width="${width}" height="${height}" alt="Business card" style="display:block;width:${width}px;height:${height}px;border-radius:${card.radius}px;">${overlays}</div>`;
  }
  const bands = sliceCard(width, height, spots);
  // The first slice describes the whole design; other plain slices are decorative (alt="").
  const name = c.doc.details.name.trim();
  let described = false;
  const describe = () =>
    described
      ? ""
      : ((described = true),
        card.kind === "signature" ? (name ? `${name} – email signature` : "Email signature") : name ? `${name} – business card` : "Business card");
  const rows = bands.map((band) => {
    const cells = band.map((s) => {
      const req: ImageRequest = {
        kind: "slice",
        key: `slice|${meta.hash}|${width}|${card.radius}|${s.x},${s.y},${s.w},${s.h}`,
        label: "Business card",
        assetId: card.assetId!,
        cardW: width,
        cardH: height,
        radius: card.radius,
        ...s,
      };
      const src = source(c, req, () => null);
      if (!src) return cell("", `width:${s.w}px;`);
      const alt = s.href ? (spots.find((h) => h.href === s.href)?.label ?? "") : describe();
      const img = imgTag(src, s.w, s.h, alt);
      return cell(
        s.href ? `<a href="${esc(s.href)}" style="text-decoration:none;display:block;">${img}</a>` : img,
        `width:${s.w}px;line-height:0;font-size:0;`,
        `width="${s.w}"`,
      );
    });
    return row(cell(table(row(cells.join("")), `width:${width}px;`, `width="${width}"`), "line-height:0;font-size:0;"));
  });
  return table(rows.join(""), `width:${width}px;`, `width="${width}"`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export function renderSignature(doc: SignatureDoc, opts: RenderOptions): RenderResult {
  const reply = opts.variant === "reply";
  const compact = reply && doc.reply.compact;
  const c: Ctx = {
    doc,
    opts,
    images: [],
    errors: [],
    preview: opts.mode === "preview",
    compact,
    show: {
      photo: !reply || doc.reply.keepPhoto,
      logo: !reply || doc.reply.keepLogo,
      social: !reply || doc.reply.keepSocial,
      addons: !reply,
      card: !reply || doc.card.inReplies,
    },
  };
  const template = getTemplate(doc.templateId);
  const digitalUrl = doc.digitalCardUrl ?? null;
  const cardOnly = doc.card.enabled && doc.card.cardOnly && doc.card.assetId && c.show.card;
  // A reply that keeps the design uses it as-is, without the compact text layout.
  const main = cardOnly ? cardHtml(c, digitalUrl) : (compact ? L.compact : L[template.layout])(c);
  const blocks = [addonsTop(c), main, cardOnly ? "" : cardHtml(c, digitalUrl), ...addonsBottom(c, digitalUrl)];
  const align = doc.design.align === "center" && !compact ? "center" : "left";
  const body = stack(c, blocks, 12, align === "center" ? "center" : undefined);
  const html = body
    ? `<table ${TABLE} style="border-collapse:collapse;"><tr><td style="font-family:${font(c, "body")};font-size:${doc.design.fontSize}px;color:${esc(doc.design.text)};text-align:${align};">${body}</td></tr></table>`
    : "";
  const seen = new Set<string>();
  const images = c.images.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
  return { html, images, errors: [...new Set(c.errors)] };
}
