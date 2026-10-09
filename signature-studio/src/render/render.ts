/**
 * Signature renderer: one pure function produces both the live preview and
 * the Gmail-ready HTML (tables + inline styles, no scripts, no <style>).
 *
 * preview: local images (object URLs / inline SVG), never sent anywhere.
 * email:   every image must resolve to a verified public URL, or it's an error.
 */
import { BRAND } from "../brand";
import { GMAIL_SIGNATURE_LIMIT } from "./validate";
import { esc, escText } from "../lib/escape";
import { linkTarget, mailtoHref, normalizeWebUrl, safeHref, telHref, displayWebUrl } from "../lib/url";
import { cropRect } from "../core/crop";
import { frameLayout, framePath, isPlainLook, lookKey, lookMatrix, matrixValues, shortHash, type FrameShape, type ImageLook } from "../core/imageLook";
import { clampScale, scaleDoc } from "../core/scale";
import { fontDef, fontStack, isCustomFont } from "../core/fonts";
import { PLATFORM_MAP } from "../core/social";
import type { Block, BlockStyle, ButtonStyle, BlockType, Box, Column, Design, Hotspot, ImageShape, ImageSlot, SignatureDoc, Variant } from "../core/types";
import { parseRich, plainRich, type RichNode } from "../core/richtext";
import { resolveBlockStyle } from "../core/textStyles";
import { pickBanner } from "../core/liveBanner";
import { getTemplate, type LayoutId } from "../core/templates";
import { badgeSvg, glyphSvg, qrSvg, socialSvg, svgDataUrl } from "./icons";

// ---------------------------------------------------------------------------
// Image requests
// ---------------------------------------------------------------------------

interface Base {
  key: string;
  label: string;
  /** Part of a live banner: which block, and which item (-1 = the fallback). */
  live?: { block: string; item: number };
}

export type ImageRequest = Base &
  (
    | {
        kind: "crop";
        assetId: string;
        w: number;
        h: number;
        rect: { sx: number; sy: number; sw: number; sh: number };
        shape: ImageShape;
        radius: number;
        /** Frame, border, shadow and colour (absent for a plain crop). `w`/`h` are then the whole output, shadow included. */
        look?: { look: ImageLook; frame: FrameShape; accent: string; fw: number; fh: number };
      }
    | { kind: "slice"; assetId: string; cardW: number; cardH: number; radius: number; x: number; y: number; w: number; h: number }
    | { kind: "video"; assetId: string; w: number; h: number; rect: { sx: number; sy: number; sw: number; sh: number } }
    | { kind: "social"; platform: string; shape: string; size: number; color: string }
    | { kind: "glyph"; name: string; size: number; color: string; bg?: string }
    | { kind: "badge"; store: "apple" | "google"; height: number }
    | { kind: "qr"; value: string; size: number; color: string }
    | { kind: "script"; text: string; color: string; size: number }
    | {
        kind: "text";
        text: string;
        family: string;
        size: number;
        weight: number;
        italic: boolean;
        color: string;
        tracking: number;
        lh: number;
        w: number;
        h: number;
      }
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
  /** Builder canvas: show hidden blocks faded so they can still be selected. */
  editing?: boolean;
  /** email mode: base URL of the live-banner endpoint; without it live banners go out as their fallback picture. */
  liveBase?: string;
  /** Clock for live banners in the preview (tests). */
  now?: number;
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
  /** Whole-signature scale; stored sizes are pre-scaled, built-in ones go through z(). */
  k: number;
}

/** Scale one of the renderer's own built-in sizes. */
function z(c: Ctx, n: number): number {
  return Math.round(n * c.k);
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

function nameHtml(c: Ctx, o: { size?: number; color?: string; align?: string; upper?: boolean; href?: string | null } = {}): string {
  const d = c.doc.details;
  const design = c.doc.design;
  const value = d.name.trim() || (c.preview ? "Your Name" : "");
  if (!value) return "";
  const size = o.size ?? Math.round(design.fontSize * design.nameScale);
  const pron = d.pronouns.trim()
    ? ` <span style="font-size:${design.fontSize - 1}px;font-weight:400;color:${esc(design.muted)};">(${esc(d.pronouns)})</span>`
    : "";
  const color = o.color ?? design.text;
  return text(c, `${link(o.href ?? null, esc(value), color)}${pron}`, {
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

function titleHtml(
  c: Ctx,
  o: { color?: string; align?: string; separate?: boolean; upper?: boolean; italic?: boolean; titleOnly?: boolean; href?: string | null } = {},
): string {
  const d = c.doc.details;
  const parts = (o.titleOnly ? [d.title] : [d.title, d.department, d.company]).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return "";
  const color = o.color ?? c.doc.design.muted;
  return text(c, link(o.href ?? null, parts.map(esc).join(` <span style="color:${esc(mix(color, "#ffffff", 0.4))};">|</span> `), color), {
    color,
    align: o.align,
    upper: o.upper,
    italic: o.italic,
    role: o.italic ? "heading" : undefined,
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
  const frame: FrameShape = slot.look?.frame ?? slot.shape;
  const square = frame === "circle" || label === "Photo";
  const aspect = square ? 1 : (slot.aspect ?? meta.width / meta.height);
  const h = Math.max(1, Math.round(w / aspect));
  const html = isPlainLook(slot.look) ? plainImage(c, slot, meta, label, w, h, aspect, frame as ImageShape) : styledImage(c, slot, meta, label, w, h, frame);
  if (!html) return "";
  return slot.link ? link(normalizeWebUrl(slot.link), html, c.doc.design.accent) : html;
}

type Meta = SignatureDoc["assets"][string];

function plainImage(c: Ctx, slot: ImageSlot, meta: Meta, label: string, w: number, h: number, aspect: number, shape: ImageShape): string {
  const rect = cropRect(meta.width, meta.height, aspect, slot.crop);
  const radius = shape === "rounded" ? Math.round(w * 0.12) : 0;
  const req: ImageRequest = {
    kind: "crop",
    key: `crop|${meta.hash}|${w}x${h}|${rect.sx.toFixed(1)},${rect.sy.toFixed(1)},${rect.sw.toFixed(1)}|${shape}`,
    label,
    assetId: slot.assetId!,
    w,
    h,
    rect,
    shape,
    radius,
  };
  if (c.preview) {
    c.images.push(req);
    const src = c.opts.sourceUrl?.(slot.assetId!) ?? "";
    const k = w / rect.sw;
    const br = shape === "circle" ? "50%" : `${radius}px`;
    return `<div style="width:${w}px;height:${h}px;overflow:hidden;position:relative;border-radius:${br};"><img src="${esc(src)}" alt="${esc(label)}" style="position:absolute;max-width:none;left:${(-rect.sx * k).toFixed(1)}px;top:${(-rect.sy * k).toFixed(1)}px;width:${(meta.width * k).toFixed(1)}px;height:${(meta.height * k).toFixed(1)}px;"></div>`;
  }
  const src = source(c, req, () => null);
  return src ? imgTag(src, w, h, label) : "";
}

/** Framed, bordered, shadowed or recoloured: one baked image in email, the same geometry as inline SVG while editing. */
function styledImage(c: Ctx, slot: ImageSlot, meta: Meta, label: string, w: number, h: number, frame: FrameShape): string {
  const look = slot.look!;
  const accent = c.doc.design.accent;
  const L = frameLayout(look, frame, w, h);
  const rect = cropRect(meta.width, meta.height, L.inner.w / L.inner.h, slot.crop);
  const req: ImageRequest = {
    kind: "crop",
    key: `crop|${meta.hash}|${w}x${h}|${rect.sx.toFixed(1)},${rect.sy.toFixed(1)},${rect.sw.toFixed(1)}|${frame}|${shortHash(lookKey(look, accent))}`,
    label,
    assetId: slot.assetId!,
    w: L.W,
    h: L.H,
    rect,
    shape: "square",
    radius: 0,
    look: { look, frame, accent, fw: w, fh: h },
  };
  if (!c.preview) {
    const src = source(c, req, () => null);
    return src ? imgTag(src, L.W, L.H, label) : "";
  }
  c.images.push(req);
  const src = c.opts.sourceUrl?.(slot.assetId!) ?? "";
  const id = `lk${shortHash(req.key)}`;
  const f = L.frame;
  const i = L.inner;
  const outer = framePath(frame, f.x, f.y, f.w, f.h, f.r);
  const inner = framePath(frame, i.x, i.y, i.w, i.h, i.r);
  const k = i.w / rect.sw;
  const m = lookMatrix(look, accent);
  const defs = [
    `<clipPath id="${id}o"><path d="${outer}"/></clipPath>`,
    `<clipPath id="${id}i"><path d="${inner}"/></clipPath>`,
    m ? `<filter id="${id}f" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrixValues(m)}"/></filter>` : "",
    look.shadow
      ? `<filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="${(L.m / 3).toFixed(1)}" stdDeviation="${(L.m * 0.45).toFixed(1)}" flood-color="#000" flood-opacity="0.28"/></filter>`
      : "",
  ].join("");
  const parts = [
    look.shadow ? `<path d="${outer}" fill="${esc(look.backing ?? "#ffffff")}" filter="url(#${id}s)"/>` : "",
    look.backing ? `<path d="${outer}" fill="${esc(look.backing)}"/>` : "",
    `<g clip-path="url(#${id}i)"><image href="${esc(src)}" x="${(i.x - rect.sx * k).toFixed(1)}" y="${(i.y - rect.sy * k).toFixed(1)}" width="${(meta.width * k).toFixed(1)}" height="${(meta.height * k).toFixed(1)}" preserveAspectRatio="none"${m ? ` filter="url(#${id}f)"` : ""}/></g>`,
    look.border
      ? `<path d="${outer}" fill="none" stroke="${esc(look.borderColor ?? accent)}" stroke-width="${look.border * 2}" clip-path="url(#${id}o)"/>`
      : "",
  ].join("");
  return `<svg width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" role="img" aria-label="${esc(label)}" style="display:block;overflow:visible;"><defs>${defs}</defs>${parts}</svg>`;
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

function contactsGrid(c: Ctx): string {
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
  return gridRows.length ? table(gridRows.join("")) : "";
}

function contactsChips(c: Ctx): string {
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
  return rows.length ? table(rows.join("")) : "";
}

function monogramTile(c: Ctx, size: number): string {
  const d = c.doc.design;
  return table(
    row(
      cell(
        text(c, esc(initials(c.doc.details.name)), { role: "heading", size: Math.round(size * 0.38), weight: 700, color: "#ffffff", align: "center", lh: 1 }),
        `width:${size}px;height:${size}px;background-color:${d.accent};border-radius:${Math.round(size / 2)}px;text-align:center;vertical-align:middle;`,
        `width="${size}" height="${size}" bgcolor="${esc(d.accent)}" align="center" valign="middle"`,
      ),
    ),
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
      [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), left && photoHtml(c) ? logoHtml(c, Math.min(c.doc.images.logo.size, z(c, 90))) : ""],
      6,
    );
    if (!left) return right;
    return table(row(vRule(c).cells(cell(left, "vertical-align:top;"), cell(right, "vertical-align:top;"))));
  },
  stacked: (c) => stack(c, [photoHtml(c), stack(c, [nameHtml(c), titleHtml(c)], 2), hRule(c, z(c, 260)), contactsHtml(c), socialsHtml(c), logoHtml(c)], 8),
  centered: (c) =>
    stack(
      c,
      [
        photoHtml(c) || logoHtml(c),
        stack(c, [nameHtml(c, { align: "center" }), titleHtml(c, { align: "center" })], 2, "center"),
        hRule(c, z(c, 60)),
        contactsHtml(c, { inline: true, align: "center" }),
        socialsHtml(c, { align: "center" }),
        photoHtml(c) ? logoHtml(c, z(c, 90)) : "",
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
        (photoHtml(c, z(c, 64)) ? cell(photoHtml(c, z(c, 64)), `vertical-align:top;padding-right:${sp(c, 14)}px;`) : "") +
          cell(stack(c, [contactsHtml(c), socialsHtml(c)], 8), "vertical-align:top;") +
          (logoHtml(c) ? cell(logoHtml(c, z(c, 90)), `vertical-align:top;padding-left:${sp(c, 14)}px;`, 'align="right"') : ""),
      ),
    );
    return table(
      row(cell(band)) +
        row(cell(body, `padding:${pad}px ${pad + 4}px;border:1px solid ${mix(d.accent, "#ffffff", 0.82)};border-top:0;border-radius:0 0 8px 8px;`)),
      `width:${Math.min(d.width, z(c, 460))}px;`,
      `width="${Math.min(d.width, z(c, 460))}"`,
    );
  },
  sidebar: (c) => {
    const d = c.doc.design;
    const details = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), logoHtml(c, z(c, 90))], 6);
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
    const logo = logoHtml(c, z(c, 80));
    return table(
      row(cell(stack(c, [inner, logo], 12), `background-color:${d.surface};padding:${pad}px ${pad + 4}px;border-radius:14px;`, `bgcolor="${esc(d.surface)}"`)),
    );
  },
  split3: (c) => {
    const photo = photoHtml(c);
    const mid = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c)], 6);
    const right = stack(c, [logoHtml(c, z(c, 90)), socialsHtml(c)], 10);
    let cells = (photo ? cell(photo, `vertical-align:middle;padding-right:${sp(c, 14)}px;`) : "") + cell(mid, "vertical-align:middle;");
    if (right) cells = vRule(c).cells(cells, cell(right, "vertical-align:middle;"));
    return table(row(cells));
  },
  compact: (c) => {
    const d = c.doc.design;
    const head = [nameHtml(c, { size: Math.round(d.fontSize * 1.1) }), titleHtml(c)].filter(Boolean);
    const line = table(row(head.map((h, i) => cell(h, i ? `padding-left:${sp(c, 10)}px;vertical-align:bottom;` : "vertical-align:bottom;")).join("")));
    const photo = photoHtml(c, z(c, 44));
    const logo = logoHtml(c, z(c, 64));
    const body = stack(c, [line, contactsHtml(c, { inline: true }), socialsHtml(c, { size: z(c, 16) })], 4);
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
    return stack(c, [company, name, title, hRule(c, z(c, 320)), contactsHtml(c, { inline: true }), socialsHtml(c), logoHtml(c, z(c, 90))], 6);
  },
  monogram: (c) => {
    const left = photoHtml(c) || monogramTile(c, Math.round(64 * c.doc.design.spacing));
    return table(
      row(
        cell(left, `vertical-align:top;padding-right:${sp(c, 16)}px;`) +
          cell(stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), logoHtml(c, z(c, 90))], 6), "vertical-align:top;"),
      ),
    );
  },
  photoRight: (c) => {
    const right = photoHtml(c) || logoHtml(c);
    const left = stack(c, [nameHtml(c), titleHtml(c), contactsHtml(c), socialsHtml(c), photoHtml(c) ? logoHtml(c, z(c, 90)) : ""], 6);
    if (!right) return left;
    return table(row(vRule(c).cells(cell(left, "vertical-align:top;"), cell(right, "vertical-align:top;"))));
  },
  grid: (c) => {
    const grid = contactsGrid(c);
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
    const chipRows = contactsChips(c);
    const top = table(
      row(
        (logoHtml(c, z(c, 56)) ? cell(logoHtml(c, z(c, 56)), `vertical-align:middle;padding-right:${sp(c, 12)}px;`) : "") +
          cell(stack(c, [nameHtml(c), titleHtml(c)], 2), "vertical-align:middle;"),
      ),
    );
    return stack(c, [photoHtml(c), top, chipRows, socialsHtml(c)], 10);
  },
};

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

function button(c: Ctx, label: string, href: string | null, style: ButtonStyle, iconName?: string): string {
  const d = c.doc.design;
  const safe = safeHref(href);
  if (!safe) {
    if (c.preview) c.errors.push(`"${label}" has no link.`);
    if (!c.preview) return "";
  }
  if (style === "link") return text(c, link(safe, `${esc(label)}&nbsp;&rarr;`, d.accent), { weight: 600, color: d.accent });
  const solid = style !== "outline" && style !== "squareOutline";
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
          "border-radius": style === "pill" ? "999px" : style === "square" || style === "squareOutline" ? undefined : "6px",
          padding: `${sp(c, 8)}px ${sp(c, 16)}px`,
        }),
        solid ? `bgcolor="${esc(d.accent)}"` : "",
      ),
    ),
    "border-collapse:separate;",
  );
}

function signOffHtml(c: Ctx, value: string, script: boolean): string {
  if (!value.trim()) return "";
  const d = c.doc.design;
  if (!script) return text(c, escText(value), { color: d.text });
  const size = Math.round(d.fontSize * 2.1);
  const req: ImageRequest = { kind: "script", key: `script|${value}|${d.text}|${size}`, label: "Sign-off", text: value, color: d.text, size };
  if (c.preview) {
    c.images.push(req);
    return `<div style="font-family:'${SCRIPT_FONT}',cursive;font-size:${size}px;line-height:${Math.round(size * 1.15)}px;color:${esc(d.text)};">${escText(value)}</div>`;
  }
  const src = source(c, req, () => null);
  if (!src) return "";
  // Approximate width: the derivative reports exact size; keep aspect via height only.
  const w = estimateScriptWidth(value, size);
  return imgTag(src, w, Math.round(size * 1.35), value);
}

function addonsTop(c: Ctx): string {
  const s = c.doc.addons.signOff;
  if (!c.show.addons || !s.enabled) return "";
  return signOffHtml(c, s.text, s.script);
}

export function estimateScriptWidth(text: string, size: number): number {
  return Math.max(40, Math.round(text.length * size * 0.42 + size * 0.4));
}

function buttonsRow(c: Ctx, buttons: string[]): string {
  const list = buttons.filter(Boolean);
  if (!list.length) return "";
  return table(row(list.map((b, i) => cell(b, i ? `padding-left:${sp(c, 8)}px;` : "")).join("")));
}

function quoteHtml(c: Ctx, quote: string, author: string): string {
  if (!quote.trim()) return "";
  const d = c.doc.design;
  return table(
    row(
      cell(
        text(c, `&ldquo;${escText(quote)}&rdquo;`, { italic: true, color: d.text, role: "heading" }) +
          (author.trim() ? text(c, `&mdash; ${esc(author)}`, { size: d.fontSize - 2, color: d.muted }) : ""),
        `border-left:3px solid ${d.accent};padding-left:${sp(c, 10)}px;`,
      ),
    ),
  );
}

function reviewsHtml(c: Ctx, rating: number, label: string, url: string): string {
  const d = c.doc.design;
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  const stars = Array.from({ length: 5 }, (_, i) => {
    const src = glyphImg(c, "star", 15, i < n ? "#f5a623" : mix(d.muted, "#ffffff", 0.6));
    return src ? cell(imgTag(src, 15, 15, i < n ? "★" : "☆"), "padding-right:2px;") : "";
  }).join("");
  const tail = label.trim()
    ? cell(
        text(c, link(url ? normalizeWebUrl(url) : null, esc(label), d.accent), { size: d.fontSize - 1, weight: 600 }),
        `padding-left:${sp(c, 8)}px;vertical-align:middle;`,
      )
    : "";
  return table(row(stars + tail));
}

function videoHtml(c: Ctx, assetId: string | undefined, url: string, title: string): string {
  if (!assetId || !c.doc.assets[assetId]) return "";
  const d = c.doc.design;
  const meta = c.doc.assets[assetId];
  const w = z(c, 240);
  const h = z(c, 135);
  const rect = cropRect(meta.width, meta.height, w / h, { x: 0, y: 0, zoom: 1 });
  const req: ImageRequest = { kind: "video", key: `video|${meta.hash}|${w}x${h}`, label: "Video thumbnail", assetId, w, h, rect };
  let thumb: string;
  if (c.preview) {
    c.images.push(req);
    const src = c.opts.sourceUrl?.(assetId) ?? "";
    const play = svgDataUrl(glyphSvg("play", 44, "#ffffff"));
    thumb = `<div style="width:${w}px;height:${h}px;position:relative;border-radius:8px;overflow:hidden;background:url('${esc(src)}') center/cover;"><img src="${play}" width="44" height="44" alt="" style="position:absolute;left:${(w - 44) / 2}px;top:${(h - 44) / 2}px;opacity:.92;"></div>`;
  } else {
    const src = source(c, req, () => null);
    thumb = src ? imgTag(src, w, h, title || "Video") : "";
  }
  if (!thumb) return "";
  const href = url ? normalizeWebUrl(url) : null;
  return stack(
    c,
    [link(href, thumb, d.accent), title.trim() ? text(c, link(href, `&#9654;&nbsp;${esc(title)}`, d.accent), { size: d.fontSize - 1, weight: 600 }) : ""],
    4,
  );
}

function appsHtml(c: Ctx, appStore: string, googlePlay: string): string {
  const cells: string[] = [];
  for (const [store, url] of [
    ["apple", appStore],
    ["google", googlePlay],
  ] as const) {
    if (!url.trim()) continue;
    const height = z(c, 34);
    const req: ImageRequest = {
      kind: "badge",
      key: `badge|${store}|${height}`,
      label: store === "apple" ? "App Store badge" : "Google Play badge",
      store,
      height,
    };
    const src = source(c, req, () => svgDataUrl(badgeSvg(store, height)));
    if (src) cells.push(cell(link(normalizeWebUrl(url), imgTag(src, Math.round(height * 3.1), height, req.label), c.doc.design.accent), "padding-right:8px;"));
  }
  return cells.length ? table(row(cells.join(""))) : "";
}

function digitalCardLinkHtml(c: Ctx, digitalUrl: string | null): string {
  const d = c.doc.design;
  const url = digitalUrl ?? (c.preview ? "https://example.com/card" : null);
  if (!url) return "";
  const size = z(c, 64);
  const qrReq: ImageRequest = { kind: "qr", key: `qr|${url}|${size}|${d.text}`, label: "Digital card QR code", value: url, size, color: d.text };
  const qr = source(c, qrReq, () => svgDataUrl(qrSvg(url, size, d.text)));
  return table(
    row(
      (qr
        ? cell(link(url, imgTag(qr, size, size, "QR code to my digital business card"), d.accent), `padding-right:${sp(c, 10)}px;vertical-align:middle;`)
        : "") +
        cell(
          text(c, link(url, "View my digital business card&nbsp;&rarr;", d.accent), { weight: 600, color: d.accent }) +
            text(c, "Save my contact in one tap", { size: d.fontSize - 2, color: d.muted }),
          "vertical-align:middle;",
        ),
    ),
  );
}

function smallPrint(c: Ctx, value: string, color?: string, prefix = ""): string {
  if (!value.trim()) return "";
  const d = c.doc.design;
  return `<div style="max-width:${Math.min(d.width, 520)}px;">${text(c, `${prefix}${escText(value)}`, { size: Math.max(9, d.fontSize - 3), color: color ?? d.muted, lh: 1.45 })}</div>`;
}

function addonsBottom(c: Ctx, digitalUrl: string | null): string[] {
  if (!c.show.addons) return [];
  const a = c.doc.addons;
  const d = c.doc.design;
  const out: string[] = [];
  out.push(
    buttonsRow(c, [
      a.cta.enabled && a.cta.text.trim() ? button(c, a.cta.text, a.cta.url ? normalizeWebUrl(a.cta.url) : websiteHref(c.doc.details.website), a.cta.style) : "",
      a.meeting.enabled && a.meeting.text.trim() ? button(c, a.meeting.text, a.meeting.url ? normalizeWebUrl(a.meeting.url) : null, "outline", "calendar") : "",
    ]),
  );
  if (a.quote.enabled) out.push(quoteHtml(c, a.quote.text, a.quote.author));
  if (a.reviews.enabled) out.push(reviewsHtml(c, a.reviews.rating, a.reviews.text, a.reviews.url));
  if (a.video.enabled) out.push(videoHtml(c, a.video.assetId, a.video.url, a.video.title));
  if (a.apps.enabled) out.push(appsHtml(c, a.apps.appStore, a.apps.googlePlay));
  if (a.banner.enabled && a.banner.assetId && c.doc.assets[a.banner.assetId]) {
    const slot: ImageSlot = {
      assetId: a.banner.assetId,
      size: Math.min(a.banner.width, d.width),
      // Rounding would freeze an animated GIF, so GIF banners keep square corners.
      shape: c.doc.assets[a.banner.assetId].mime === "image/gif" ? "square" : "rounded",
      crop: { x: 0, y: 0, zoom: 1 },
      link: a.banner.url || undefined,
    };
    out.push(slotImage(c, slot, a.banner.alt || "Banner"));
  }
  if (c.doc.card.enabled && c.doc.card.digitalLink && c.doc.card.assetId && c.show.card) out.push(digitalCardLinkHtml(c, digitalUrl));
  if (a.disclaimer.enabled) out.push(smallPrint(c, a.disclaimer.text));
  if (a.green.enabled) out.push(smallPrint(c, a.green.text, "#3f8f4f", "&#127807;&nbsp;"));
  return out.filter(Boolean);
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
// Builder blocks — rows of columns of blocks, rendered with the same parts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Live banners
// ---------------------------------------------------------------------------

/** Mark the request slotImage just added as part of a live banner. */
function tagLast(c: Ctx, before: number, live: { block: string; item: number }) {
  for (let i = before; i < c.images.length; i++) c.images[i].live = live;
}

/**
 * A banner whose picture changes after the email is sent. Every picture is
 * published at the block's size; the email shows the live endpoint, which
 * redirects to whichever is current. The editor shows today's.
 */
function liveBannerHtml(c: Ctx, b: Extract<Block, { type: "image" }>, slot: ImageSlot): string {
  const live = b.live!;
  const meta = c.doc.assets[b.assetId!];
  const frame = { ...slot, aspect: slot.aspect ?? meta.width / meta.height, link: undefined };
  const items = live.items.filter((i) => i.assetId && c.doc.assets[i.assetId]);
  const label = b.alt || "Banner";
  if (c.preview) {
    const today = pickBanner(
      {
        mode: live.mode,
        items: items.map((i) => ({ image: i.assetId!, link: i.link, from: i.from, to: i.to })),
        fallback: { image: b.assetId!, link: b.link },
      },
      c.opts.now ?? Date.now(),
    );
    const shown = today.index < 0 ? b : items[today.index];
    const n = c.images.length;
    const html = slotImage(c, { ...frame, assetId: shown.assetId, crop: today.index < 0 ? slot.crop : { x: 0, y: 0, zoom: 1 } }, label);
    tagLast(c, n, { block: b.id, item: today.index < 0 ? -1 : live.items.indexOf(shown as (typeof live.items)[number]) });
    return link(linkTarget(shown.link ?? b.link) ?? null, html, c.doc.design.accent);
  }
  // Email: publish every picture; show the fallback, or the live endpoint once it exists.
  let n = c.images.length;
  const main = slotImage(c, frame, label);
  tagLast(c, n, { block: b.id, item: -1 });
  live.items.forEach((it, i) => {
    if (!it.assetId || !c.doc.assets[it.assetId]) return;
    n = c.images.length;
    slotImage(c, { ...frame, assetId: it.assetId, crop: { x: 0, y: 0, zoom: 1 } }, `${label} ${i + 1}`);
    tagLast(c, n, { block: b.id, item: i });
  });
  if (!main) return "";
  if (!c.opts.liveBase || !live.slug) return link(linkTarget(b.link) ?? null, main, c.doc.design.accent);
  const base = `${c.opts.liveBase.replace(/\/$/, "")}/banner/${live.slug}`;
  return link(`${base}/go`, main.replace(/src="[^"]*"/, `src="${esc(`${base}/img`)}"`), c.doc.design.accent);
}

// ---------------------------------------------------------------------------
// Brand-font text sent as an image
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Width of a line in a CSS font: measured on a canvas in the browser, estimated elsewhere. */
export function measureLine(line: string, cssFont: string, size: number): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    measureCtx.font = cssFont;
    return measureCtx.measureText(line).width;
  }
  return line.length * size * 0.56;
}

const caseText = (s: string, c?: string) =>
  c === "upper" ? s.toUpperCase() : c === "lower" ? s.toLowerCase() : c === "title" ? s.replace(/\b\p{L}/gu, (m) => m.toUpperCase()) : s;

/**
 * A name or text block in an uploaded font: no inbox has the font, so the
 * text goes out as a crisp image (with the words as its alt text).
 */
function textImage(c: Ctx, b: Block, sc: string | undefined): string | null {
  const st = b.style ?? {};
  const d = c.doc.design;
  let value: string;
  let size: number;
  let weight: number;
  let lh: number;
  let href: string | null = null;
  if (b.type === "name") {
    value = c.doc.details.name.trim();
    size = Math.round(d.fontSize * d.nameScale * (b.scale ?? 1));
    weight = st.weight ?? 700;
    lh = st.lineHeight ?? 1.2;
    href = linkTarget(b.link);
    if (st.case === undefined && (b.upper || d.nameCase === "upper")) value = value.toUpperCase();
  } else if (b.type === "text") {
    value = plainRich(b.text).trim();
    size = b.size ?? st.fontSize ?? d.fontSize;
    weight = st.weight ?? (b.bold ? 700 : 400);
    lh = st.lineHeight ?? 1.45;
    href = linkTarget(b.link);
  } else return null;
  if (!value) return null;
  value = caseText(value, st.case);
  const family = fontDef(st.font!).family;
  const italic = !!(st.italic ?? (b.type === "text" && b.italic));
  const tracking = st.tracking ?? 0;
  const color = sc ?? (b.type === "text" && b.muted ? d.muted : d.text);
  const lines = value.split("\n");
  const cssFont = `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
  const w = Math.ceil(Math.max(...lines.map((l) => measureLine(l, cssFont, size) + tracking * size * l.length)) + 4);
  const h = Math.ceil(lines.length * size * lh);
  const req: ImageRequest = {
    kind: "text",
    key: `text|${shortHash([value, family, size, weight, italic, color, tracking, lh, w].join("|"))}`,
    label: b.type === "name" ? "Name" : "Text",
    text: value,
    family,
    size,
    weight,
    italic,
    color,
    tracking,
    lh,
    w,
    h,
  };
  const src = source(c, req, () => null);
  if (!src) return "";
  return link(href, imgTag(src, w, h, value.replace(/\n/g, " ")), color);
}

/** A block's text colour: a custom colour, else the colour role it follows, else none. */
export function styleColor(st: BlockStyle | undefined, d: Design): string | undefined {
  if (st?.color) return st.color;
  if (st?.colorRole) return st.colorRole === "accent" ? d.accent : st.colorRole === "muted" ? d.muted : d.text;
  return undefined;
}

/** Apply a block's style overrides to the design its parts read. */
function withStyle(c: Ctx, st?: BlockStyle): Ctx {
  const color = styleColor(st, c.doc.design);
  if (!st || (!color && !st.accent && !st.font && !st.fontSize)) return c;
  const d = c.doc.design;
  const design = {
    ...d,
    text: color ?? d.text,
    accent: st.accent ?? d.accent,
    headingFont: st.font ?? d.headingFont,
    bodyFont: st.font ?? d.bodyFont,
    fontSize: st.fontSize ?? d.fontSize,
  };
  return { ...c, doc: { ...c.doc, design } };
}

/**
 * Block-level typography (weight, italic, underline, strike, case, line
 * height, letter spacing) applied to every text element the block produced.
 * Text elements are the ones that set a font-family; later declarations in an
 * inline style win, so the override is simply appended.
 */
export function withTypography(html: string, st?: BlockStyle): string {
  if (!st) return html;
  const deco = [st.underline && "underline", st.strike && "line-through"].filter(Boolean).join(" ");
  const decl = css({
    "font-weight": st.weight,
    "font-style": st.italic === undefined ? undefined : st.italic ? "italic" : "normal",
    "text-decoration": deco || undefined,
    "text-transform":
      st.case === "upper" ? "uppercase" : st.case === "lower" ? "lowercase" : st.case === "title" ? "capitalize" : st.case === "none" ? "none" : undefined,
    "font-variant": st.case === "smallcaps" ? "small-caps" : undefined,
    "line-height": st.lineHeight ? `${Math.round(st.lineHeight * 100)}%` : undefined,
    "letter-spacing": st.tracking !== undefined ? `${st.tracking}em` : undefined,
  });
  if (!decl) return html;
  return html.replace(/style="([^"]*font-family:[^"]*)"/g, (_m, s: string) => `style="${s}${s.trim().endsWith(";") ? "" : ";"}${decl}"`);
}

function boxed(html: string, box?: Box): string {
  if (!html || !box || !(box.padding || box.background || box.borderWidth)) return html;
  const side = box.borderSide ?? "all";
  const border = box.borderWidth ? `${box.borderWidth}px solid ${box.borderColor ?? "#dddddd"}` : undefined;
  const style = css({
    "background-color": box.background,
    padding: box.padding ? `${box.padding}px` : undefined,
    "border-radius": box.radius ? `${box.radius}px` : undefined,
    border: side === "all" ? border : undefined,
    "border-left": side === "left" ? border : undefined,
    "border-top": side === "top" ? border : undefined,
    "border-bottom": side === "bottom" ? border : undefined,
  });
  return table(row(cell(html, style, box.background ? `bgcolor="${esc(box.background)}"` : "")), box.radius ? "border-collapse:separate;" : "");
}

/** What an empty block looks like while editing (never in email). */
function placeholder(label: string, w = 0, h = 0, round = false): string {
  const size = w ? `width:${w}px;height:${h || w}px;` : "padding:8px 12px;";
  return `<div style="${size}display:flex;align-items:center;justify-content:center;box-sizing:border-box;border:1.5px dashed #c9c4ee;border-radius:${round ? "50%" : "8px"};color:#8a84bd;font:600 11px/1.3 system-ui,sans-serif;text-align:center;background:#faf9ff;">${esc(label)}</div>`;
}

function showsIn(b: Block, variant: Variant): boolean {
  return !b.visibility || b.visibility === "both" || b.visibility === variant;
}

/** Text with inline formatting (see core/richtext.ts); everything else escaped, newlines kept. */
function richText(raw: string, linkColor: string): string {
  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((n) => {
        switch (n.t) {
          case "text":
            return escText(n.v);
          case "link": {
            const href = linkTarget(n.href);
            // An unusable target (javascript:, garbage) stays visible as typed.
            return href ? link(href, walk(n.kids), linkColor) : escText(n.raw);
          }
          case "color":
            return `<span style="color:${esc(n.color)};">${walk(n.kids)}</span>`;
          case "mark":
            switch (n.mark) {
              case "bold":
                return `<strong style="font-weight:700;">${walk(n.kids)}</strong>`;
              case "italic":
                return `<em style="font-style:italic;">${walk(n.kids)}</em>`;
              case "underline":
                return `<u style="text-decoration:underline;">${walk(n.kids)}</u>`;
              case "strike":
                return `<s style="text-decoration:line-through;">${walk(n.kids)}</s>`;
              case "highlight":
                return `<span style="background-color:${mix(linkColor, "#ffffff", 0.78)};padding:0 2px;">${walk(n.kids)}</span>`;
            }
        }
      })
      .join("");
  return walk(parseRich(raw)).replace(/\n/g, "<br>");
}

/** Hover text on every link and image a block produced (unless they have one). */
function withHover(html: string, hover: string | undefined): string {
  const t = hover?.trim();
  if (!t) return html;
  const title = ` title="${esc(t)}"`;
  return html.replace(/<a (?![^>]*\btitle=)/g, `<a${title} `).replace(/<img (?![^>]*\btitle=)/g, `<img${title} `);
}

function leafHtml(c0: Ctx, b: Block, digitalUrl: string | null): string {
  const c = withStyle(c0, b.style);
  const d = c.doc.design;
  const sc = styleColor(b.style, c0.doc.design);
  const align = b.style?.align;
  const empty = (label: string, w = 0, h = 0, round = false) => (c.preview ? placeholder(label, w, h, round) : "");
  if (!c.preview && isCustomFont(b.style?.font) && b.style?.asImage !== false) {
    const img = textImage(c, b, sc);
    if (img !== null) return img;
  }
  switch (b.type) {
    case "row":
      return rowHtml(c, b, digitalUrl);
    case "name": {
      const n = nameHtml(c, { size: Math.round(d.fontSize * d.nameScale * (b.scale ?? 1)), upper: b.upper, align, href: linkTarget(b.link) });
      if (!b.underline || !n) return n;
      return table(row(cell(n, `border-bottom:4px solid ${d.accent};padding-bottom:${sp(c, 4)}px;`)));
    }
    case "title":
      return titleHtml(c, { upper: b.upper, italic: b.italic, titleOnly: b.titleOnly, align, color: sc, href: linkTarget(b.link) }) || empty("Job title");
    case "field": {
      const v = c.doc.details[b.field].trim();
      if (!v) return empty(`Add your ${b.field}`);
      const href = b.link?.trim()
        ? linkTarget(b.link)
        : b.field === "email"
          ? mailtoHref(v)
          : b.field === "website"
            ? websiteHref(v)
            : b.field === "phone" || b.field === "mobile"
              ? telHref(v)
              : null;
      const shown = b.field === "website" ? displayWebUrl(v) : v;
      return text(c, link(href, esc(shown), sc ?? (b.upper ? d.accent : d.text)), {
        upper: b.upper,
        tracking: b.upper ? 0.2 : undefined,
        weight: b.upper ? 600 : undefined,
        size: b.upper ? d.fontSize - 2 : undefined,
        color: sc ?? (b.upper ? d.accent : d.text),
        align,
      });
    }
    case "text":
      if (!b.text.trim()) return empty("Text");
      // A whole-block link keeps the inline formatting but not inner links (links can't nest).
      return text(
        c,
        b.link
          ? link(linkTarget(b.link), richText(b.text.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, "$1"), sc ?? d.text), sc ?? d.text)
          : richText(b.text, d.accent),
        {
          size: b.size,
          weight: b.bold ? 700 : undefined,
          italic: b.italic,
          upper: b.upper,
          tracking: b.upper ? 0.14 : undefined,
          color: sc ?? (b.muted ? d.muted : d.text),
          align,
          lh: 1.45,
        },
      );
    case "contacts": {
      const html =
        b.layout === "grid"
          ? contactsGrid(c)
          : b.layout === "chips"
            ? contactsChips(c)
            : contactsHtml(c, { inline: b.layout === "inline", align, iconBg: b.iconBg });
      return html || empty("Contact details");
    }
    case "socials":
      if (!c.show.social) return "";
      return socialsHtml(c, { align, size: b.size }) || empty("Social icons");
    case "photo":
      if (!c.show.photo) return "";
      return photoHtml(c, b.size) || empty("Photo", b.size ?? c.doc.images.photo.size, 0, c.doc.images.photo.shape === "circle");
    case "logo":
      if (!c.show.logo) return "";
      return logoHtml(c, b.size) || empty("Logo", b.size ?? c.doc.images.logo.size, Math.round((b.size ?? c.doc.images.logo.size) / 3));
    case "image": {
      const slot: ImageSlot = {
        assetId: b.assetId,
        size: b.width,
        shape: b.radius ? "rounded" : "square",
        crop: b.crop ?? { x: 0, y: 0, zoom: 1 },
        link: b.link || undefined,
        aspect: b.aspect,
        look: b.look,
      };
      if (b.live && b.assetId && c.doc.assets[b.assetId]) return liveBannerHtml(c, b, slot);
      return (b.assetId && c.doc.assets[b.assetId] ? slotImage(c, slot, b.alt || "Image") : "") || empty("Image", Math.min(b.width, 200), 60);
    }
    case "logos": {
      const cells = b.items
        .map((it) => {
          const m = it.assetId ? c.doc.assets[it.assetId] : null;
          if (!m) return "";
          const slot: ImageSlot = {
            assetId: it.assetId,
            size: Math.max(1, Math.round((b.height * m.width) / m.height)),
            shape: "square",
            crop: { x: 0, y: 0, zoom: 1 },
            link: it.link || undefined,
          };
          return slotImage(c, slot, it.alt || "Logo");
        })
        .filter(Boolean);
      if (!cells.length) return empty("Logo row — add logos in the inspector");
      return table(row(cells.map((h, i) => cell(h, `vertical-align:middle;${i ? `padding-left:${b.gap}px;` : ""}`)).join("")));
    }
    case "qr": {
      const url =
        b.source === "digitalCard"
          ? (digitalUrl ?? (c.preview && c.doc.card.assetId ? "https://example.com/card" : null))
          : b.source === "custom"
            ? b.url.trim()
              ? normalizeWebUrl(b.url)
              : null
            : websiteHref(c.doc.details.website);
      const safe = safeHref(url);
      if (!safe) return empty(b.source === "digitalCard" ? "QR code (needs a digital card)" : "QR code — add a link", b.size, b.size);
      const req: ImageRequest = { kind: "qr", key: `qr|${safe}|${b.size}|${d.text}`, label: "QR code", value: safe, size: b.size, color: d.text };
      const src = source(c, req, () => svgDataUrl(qrSvg(safe, b.size, d.text)));
      if (!src) return "";
      const code = link(safe, imgTag(src, b.size, b.size, b.caption || "QR code"), d.accent);
      return b.caption.trim() ? stack(c, [code, text(c, esc(b.caption), { size: Math.max(9, d.fontSize - 3), color: d.muted, align })], 3, align) : code;
    }
    case "iconText": {
      if (!b.text.trim()) return empty("Icon line");
      const s = Math.max(12, d.fontSize);
      const icon = b.iconBg ? glyphImg(c, b.icon, s + 6, "#ffffff", d.accent) : glyphImg(c, b.icon, s, d.accent);
      const is = b.iconBg ? s + 6 : s;
      const href = b.url.trim() ? normalizeWebUrl(b.url) : null;
      return text(c, `${icon ? `${inlineImg(icon, is, is, "")}&nbsp;&nbsp;` : ""}${link(href, escText(b.text), d.text)}`, { align });
    }
    case "tag": {
      if (!b.text.trim()) return empty("Tag");
      const href = b.url.trim() ? normalizeWebUrl(b.url) : null;
      const color = b.filled ? "#ffffff" : d.accent;
      const label = text(c, link(href, esc(b.text), color), { size: Math.max(9, d.fontSize - 2), weight: 700, color, nowrap: true, tracking: 0.02 });
      return table(
        row(
          cell(
            label,
            css({
              "background-color": b.filled ? d.accent : undefined,
              border: b.filled ? undefined : `1.5px solid ${d.accent}`,
              "border-radius": b.square ? undefined : "999px",
              padding: `${sp(c, 3)}px ${sp(c, 10)}px`,
            }),
            b.filled ? `bgcolor="${esc(d.accent)}"` : "",
          ),
        ),
        "border-collapse:separate;",
        align === "center" ? 'align="center"' : "",
      );
    }
    case "monogram":
      return monogramTile(c, b.size);
    case "divider": {
      const color = d.divider === "accent" ? d.accent : mix(d.muted, "#ffffff", 0.6);
      const t = b.thickness ?? (d.divider === "accent" ? 2 : 1);
      const style = d.divider === "dots" ? "dotted" : "solid";
      return table(
        row(cell("&nbsp;", `border-top:${t}px ${style} ${color};font-size:1px;line-height:1px;height:1px;`)),
        b.width ? `width:${b.width}px;` : "width:100%;",
        b.width ? `width="${b.width}"` : 'width="100%"',
      );
    }
    case "spacer":
      return `<div style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</div>`;
    case "button":
      if (!b.text.trim()) return empty("Button");
      return button(c, b.text, b.url ? normalizeWebUrl(b.url) : websiteHref(c.doc.details.website), b.buttonStyle, b.icon || undefined);
    case "signOff":
      return signOffHtml(c, b.text, b.script) || empty("Sign-off");
    case "quote":
      return quoteHtml(c, b.text, b.author) || empty("Quote");
    case "reviews":
      return reviewsHtml(c, b.rating, b.text, b.url);
    case "video":
      return videoHtml(c, b.assetId, b.url, b.title) || empty("Video thumbnail", 240, 135);
    case "apps":
      return appsHtml(c, b.appStore, b.googlePlay) || empty("App store badges");
    case "digitalCard":
      return c.doc.card.assetId ? digitalCardLinkHtml(c, digitalUrl) : empty("Digital card (add a card design first)");
    case "canva": {
      const card = c.doc.card;
      if (!card.assetId || !c.doc.assets[card.assetId]) return empty("Canva design");
      // The block itself decides placement, so the card is always shown here.
      return cardHtml({ ...c, show: { ...c.show, card: true }, doc: { ...c.doc, card: { ...card, enabled: true } } }, digitalUrl);
    }
  }
}

function blockHtml(c: Ctx, b0: Block, digitalUrl: string | null, align?: string): string {
  const b = resolveBlockStyle(b0, c.doc.design);
  const shown = showsIn(b, c.opts.variant);
  // While editing, hidden blocks stay on the canvas (faded) so they can be selected again.
  if (!shown && !(c.preview && c.opts.editing && b.visibility === "hidden")) return "";
  const html = boxed(withHover(withTypography(leafHtml(c, b, digitalUrl), b.type === "row" ? undefined : b.style), b.hover), b.style?.box);
  if (!c.preview) return html;
  // The editor's wrapper must not stop centred/right-aligned columns from aligning their blocks.
  const place = align === "center" ? "display:table;margin-left:auto;margin-right:auto;" : align === "right" ? "display:table;margin-left:auto;" : "";
  const style = `${place}${shown ? "" : "opacity:.3;"}`;
  const inner =
    align && align !== "left" && html.startsWith("<table ") && !html.startsWith("<table align") ? html.replace("<table ", `<table align="${align}" `) : html;
  return `<div data-block="${esc(b.id)}"${style ? ` style="${style}"` : ""}>${inner}</div>`;
}

function columnHtml(c: Ctx, col: Column, digitalUrl: string | null): string {
  const inner = stack(
    c,
    col.blocks.map((b) => blockHtml(c, b, digitalUrl, col.align)),
    col.gap,
    col.align === "center" ? "center" : col.align === "right" ? "right" : undefined,
  );
  if (!c.preview) return boxed(inner, col.box);
  const body = inner || placeholder("Drop blocks here");
  return `<div data-col="${esc(col.id)}" style="min-width:${inner ? 0 : 120}px;">${boxed(body, col.box)}</div>`;
}

function rowHtml(c: Ctx, b: Extract<Block, { type: "row" }>, digitalUrl: string | null): string {
  const d = c.doc.design;
  const gap = sp(c, b.gap);
  const cols = b.columns.map((col) => ({ col, html: columnHtml(c, col, digitalUrl) })).filter((x) => x.html || c.preview);
  if (!cols.length) return "";
  const cells: string[] = [];
  cols.forEach(({ col, html }, i) => {
    if (i) {
      if (b.divider) {
        const color = d.divider === "accent" ? d.accent : mix(d.muted, "#ffffff", 0.6);
        cells.push(cell("&nbsp;", `width:${Math.round(gap / 2)}px;font-size:1px;`));
        cells.push(cell("&nbsp;", `border-left:${d.divider === "accent" ? 2 : 1}px solid ${color};font-size:1px;`));
        cells.push(cell("&nbsp;", `width:${Math.round(gap / 2)}px;font-size:1px;`));
      } else cells.push(cell("&nbsp;", `width:${gap}px;font-size:1px;`, `width="${gap}"`));
    }
    cells.push(cell(html, css({ "vertical-align": b.valign, width: col.width ? `${col.width}px` : undefined }), col.width ? `width="${col.width}"` : ""));
  });
  return table(row(cells.join("")));
}

/** True when a builder layout contains a block of the given type. */
export function hasBlock(root: Column | undefined, type: BlockType): boolean {
  if (!root) return false;
  return root.blocks.some((b) => b.type === type || (b.type === "row" && b.columns.some((col) => hasBlock(col, type))));
}

// ---------------------------------------------------------------------------
// "Made with" link — free signatures carry a small, quiet credit
// ---------------------------------------------------------------------------

/** New-email signatures only (replies stay clean), unless the user turned it off. */
export function showsMadeWith(doc: SignatureDoc, variant: Variant): boolean {
  return variant === "full" && doc.madeWith !== false;
}

function madeWithHtml(c: Ctx): string {
  const d = c.doc.design;
  const color = mix(d.muted, "#ffffff", 0.25);
  return text(c, link(BRAND.url, esc(BRAND.madeWith), color), { size: Math.max(9, d.fontSize - 4), color, role: "body" });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const SWAP: Record<string, string> = { left: "right", right: "left" };

/**
 * Right-to-left: mark the signature `dir="rtl"` (which also reverses table
 * columns) and mirror every explicit left/right — alignment, padding, margins
 * and borders — so gaps and accent lines land on the correct side.
 */
export function mirrorRtl(html: string): string {
  const body = html
    .replace(/\b(padding|margin|border)-(left|right)\b/g, (_, p: string, side: string) => `${p}-${SWAP[side]}`)
    .replace(/\b(text-align|float):\s*(left|right)\b/g, (_, p: string, side: string) => `${p}:${SWAP[side]}`)
    .replace(/\balign="(left|right)"/g, (_, side: string) => `align="${SWAP[side]}"`)
    // Four-value shorthands are top right bottom left: swap right and left.
    .replace(
      /\b(padding|margin):\s*([^;"\s]+)\s+([^;"\s]+)\s+([^;"\s]+)\s+([^;"\s]+)/g,
      (_, p: string, t: string, r: string, b: string, l: string) => `${p}:${t} ${l} ${b} ${r}`,
    );
  // Latin runs (phone numbers, emails, addresses) keep their own order inside the
  // right-to-left layout — otherwise "+1 416 555 0182" shows as "0182 555 416 1+".
  const isolated = body.replace(/>([^<>]*[A-Za-z0-9][^<>]*)</g, (m, text: string) =>
    RTL_CHARS.test(text) || !text.trim() ? m : `>${text.replace(/^(\s*)(.*?)(\s*)$/s, '$1<span dir="ltr">$2</span>$3')}<`,
  );
  return isolated.replace(/^<table /, '<table dir="rtl" ').replace(/^(<table [^>]*style=")/, "$1direction:rtl;");
}

const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function renderSignature(input: SignatureDoc, opts: RenderOptions): RenderResult {
  const k = clampScale(input.design.scale);
  const doc = scaleDoc(input, k);
  const reply = opts.variant === "reply";
  // Builder signatures can give replies a layout of their own.
  const replyTree = reply && doc.mode === "builder" && doc.reply.custom ? doc.replyBlocks : undefined;
  const compact = reply && doc.reply.compact && !replyTree;
  const c: Ctx = {
    doc,
    opts,
    images: [],
    errors: [],
    preview: opts.mode === "preview",
    compact,
    show: {
      photo: !reply || !!replyTree || doc.reply.keepPhoto,
      logo: !reply || !!replyTree || doc.reply.keepLogo,
      social: !reply || !!replyTree || doc.reply.keepSocial,
      addons: !reply,
      card: !reply || doc.card.inReplies,
    },
    k,
  };
  const template = getTemplate(doc.templateId);
  const digitalUrl = doc.digitalCardUrl ?? null;
  const cardOnly = doc.card.enabled && doc.card.cardOnly && doc.card.assetId && c.show.card;
  // A reply that keeps the design uses it as-is, without the compact text layout.
  const tree = replyTree ?? doc.blocks;
  const builder = doc.mode === "builder" && tree && !compact;
  const main = builder ? columnHtml(c, tree!, digitalUrl) : cardOnly ? cardHtml(c, digitalUrl) : (compact ? L.compact : L[template.layout])(c);
  // In the builder every add-on is a block the user placed; nothing is appended.
  const blocks = builder ? [main] : [addonsTop(c), main, cardOnly ? "" : cardHtml(c, digitalUrl), ...addonsBottom(c, digitalUrl)];
  const align = doc.design.align === "center" && !compact ? "center" : "left";
  const wrap = (parts: string[]) => {
    const body = stack(c, parts, 12, align === "center" ? "center" : undefined);
    return body
      ? `<table ${TABLE} style="border-collapse:collapse;"><tr><td style="font-family:${font(c, "body")};font-size:${doc.design.fontSize}px;color:${esc(doc.design.text)};text-align:${align};">${body}</td></tr></table>`
      : "";
  };
  let html = wrap(blocks);
  if (main && showsMadeWith(doc, opts.variant)) {
    // The credit is a guest: it never pushes a signature past Gmail's limit.
    // (Only the email HTML counts — previews inline their icons, so they run long.)
    const withCredit = wrap([...blocks, madeWithHtml(c)]);
    if (c.preview || withCredit.length <= GMAIL_SIGNATURE_LIMIT) html = withCredit;
  }
  if (doc.design.direction === "rtl") html = mirrorRtl(html);
  const seen = new Set<string>();
  const images = c.images.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
  return { html, images, errors: [...new Set(c.errors)] };
}
