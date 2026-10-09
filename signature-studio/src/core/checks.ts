/**
 * Live checks: things that would look broken, be hard to read, or fail to
 * paste — found while editing, not at install time. Pure; the UI decides how
 * to show them and where each "Fix" jumps to.
 */
import { walk } from "./blocks";
import { PLATFORM_MAP } from "./social";
import type { Column, SignatureDoc } from "./types";
import { GMAIL_SIGNATURE_LIMIT } from "../render/validate";
import { renderSignature } from "../render/render";
import { INLINE_LINK } from "../lib/url";
import { gifStillReason } from "./gif";
import { cropRect } from "./crop";
import type { AssetMeta } from "./types";

/** A message when an animated GIF will be sent as a still image, else null. */
export function gifIssue(
  meta: AssetMeta | undefined,
  aspect?: number,
  crop: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 },
  shape: "square" | "rounded" | "circle" = "square",
): string | null {
  if (!meta || meta.mime !== "image/gif") return null;
  const rect = cropRect(meta.width, meta.height, aspect ?? meta.width / meta.height, crop);
  switch (gifStillReason(meta, { rect, shape })) {
    case "shaped":
      return "Rounded corners stop a GIF from animating. Turn them off to keep it moving.";
    case "cropped":
      return "Cropping stops a GIF from animating. Reset the crop to keep it moving.";
    case "too-big":
      return "This GIF is over 1 MB, so it will be sent as a still image. Use a smaller GIF to keep it moving.";
    default:
      return null;
  }
}

export type CheckLevel = "error" | "warning" | "tip";

export interface CheckIssue {
  id: string;
  level: CheckLevel;
  message: string;
  /** Where to fix it: an editor tab and/or a builder block. */
  fix?: { tab?: string; blockId?: string; label: string };
}

// ---------------------------------------------------------------------------
// Field-level checks (exported for unit tests and inline hints)
// ---------------------------------------------------------------------------

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

export function emailProblem(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(s)) return "doesn't look like an email address";
  const domain = s.split("@")[1].toLowerCase();
  if (DOMAIN_TYPOS[domain]) return `may have a typo — did you mean …@${DOMAIN_TYPOS[domain]}?`;
  if (/\.(con|cmo|ocm)$/.test(domain)) return `ends in “.${domain.split(".").pop()}” — did you mean “.com”?`;
  return null;
}

export function phoneProblem(v: string): { level: CheckLevel; message: string } | null {
  const s = v.trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (/[a-z]/i.test(s.replace(/\b(ext|x)\.?\s*\d+$/i, ""))) return { level: "warning", message: "contains letters, so phones can't dial it" };
  if (digits.length < 7) return { level: "error", message: "is too short to dial" };
  if (!s.startsWith("+")) return { level: "tip", message: "has no country code (e.g. +1) — add one so it works from abroad" };
  return null;
}

export function linkProblem(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/\s/.test(s.replace(/^\s+|\s+$/g, ""))) return "contains spaces";
  let host = "";
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`).hostname;
  } catch {
    return "isn't a valid web address";
  }
  if (!host.includes(".") || /\.$/.test(host)) return "is missing a domain ending like .com";
  return null;
}

// ---------------------------------------------------------------------------
// Contrast (WCAG relative luminance)
// ---------------------------------------------------------------------------

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 21;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

/** Characters the copied signature will use, with realistic hosted image URLs. */
export function estimateEmailSize(doc: SignatureDoc, hostBase = "https://images.example.com"): number {
  const url = `${hostBase.replace(/\/$/, "")}/s/${"0".repeat(64)}.png`;
  return renderSignature(doc, { variant: "full", mode: "email", resolve: () => url }).html.length;
}

// ---------------------------------------------------------------------------
// All checks
// ---------------------------------------------------------------------------

const LABEL: Record<string, string> = { phone: "Phone", mobile: "Mobile", email: "Email", website: "Website" };

export function runChecks(doc: SignatureDoc, opts: { size?: number } = {}): CheckIssue[] {
  const out: CheckIssue[] = [];
  const add = (i: CheckIssue) => out.push(i);
  const d = doc.details;
  const design = doc.design;
  const scale = design.scale ?? 1;
  const details = { tab: "details", label: "Edit details" };

  if (!d.name.trim() && !(doc.card.enabled && doc.card.kind === "signature"))
    add({ id: "name", level: "warning", message: "Add your name — it's the first thing people look for.", fix: details });

  // Arabic, Hebrew, Syriac, Thaana, N'Ko… read right to left.
  if (/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(`${d.name} ${d.title} ${d.company}`) && design.direction !== "rtl")
    add({
      id: "rtl",
      level: "tip",
      message: "Your details look right-to-left. Switch the text direction so they line up naturally.",
      fix: { tab: "design", label: "Set direction" },
    });

  const em = emailProblem(d.email);
  if (em) add({ id: "email", level: "error", message: `Email ${em}`, fix: details });
  for (const k of ["phone", "mobile"] as const) {
    const p = phoneProblem(d[k]);
    if (p) add({ id: k, level: p.level, message: `${LABEL[k]} ${p.message}`, fix: details });
  }
  const web = linkProblem(d.website);
  if (web) add({ id: "website", level: "error", message: `Website ${web}`, fix: details });
  d.custom.forEach((c, i) => {
    const lp = c.link ? linkProblem(c.link) : null;
    if (lp) add({ id: `custom-${i}`, level: "error", message: `The link on “${c.label || c.value || "extra line"}” ${lp}`, fix: details });
  });

  doc.socials.forEach((s, i) => {
    const name = PLATFORM_MAP[s.platform]?.label ?? "Social";
    if (!s.url.trim())
      add({ id: `social-${i}`, level: "warning", message: `${name} has no link yet, so it won't appear`, fix: { tab: "social", label: "Edit social links" } });
    else {
      const lp = linkProblem(s.url);
      if (lp) add({ id: `social-${i}`, level: "error", message: `${name} link ${lp}`, fix: { tab: "social", label: "Edit social links" } });
    }
  });

  // Readability against the white message background.
  const theme = { tab: "design", label: "Adjust colours" };
  if (contrast(design.text, "#ffffff") < 4.5) add({ id: "contrast-text", level: "warning", message: "Your text colour is hard to read on white.", fix: theme });
  if (contrast(design.muted, "#ffffff") < 3)
    add({ id: "contrast-muted", level: "warning", message: "Your secondary text colour is too faint to read.", fix: theme });
  if (contrast(design.accent, "#ffffff") < 2.4)
    add({ id: "contrast-accent", level: "warning", message: "Your accent colour is very light — links and icons may be hard to see.", fix: theme });
  if (design.fontSize * scale < 11) add({ id: "small", level: "warning", message: "Text is smaller than 11px, which is hard to read on phones.", fix: theme });

  if (doc.mode === "builder" && doc.blocks) checkBlocks(doc, doc.blocks, add);
  else {
    const a = doc.addons;
    if (a.cta.enabled && a.cta.url && linkProblem(a.cta.url))
      add({ id: "cta", level: "error", message: `Your button link ${linkProblem(a.cta.url)}`, fix: { tab: "addons", label: "Edit add-ons" } });
    if (a.meeting.enabled && !a.meeting.url.trim())
      add({ id: "meeting", level: "warning", message: "“Book a meeting” has no link yet.", fix: { tab: "addons", label: "Edit add-ons" } });
    const bannerGif = a.banner.enabled && a.banner.assetId ? gifIssue(doc.assets[a.banner.assetId]) : null;
    if (bannerGif) add({ id: "gif-banner", level: "tip", message: bannerGif, fix: { tab: "addons", label: "Edit add-ons" } });
    if (a.banner.enabled && a.banner.assetId && !a.banner.alt.trim())
      add({ id: "banner-alt", level: "tip", message: "Describe your banner for people who can't see images.", fix: { tab: "addons", label: "Edit add-ons" } });
  }

  if (opts.size !== undefined) {
    if (opts.size > GMAIL_SIGNATURE_LIMIT)
      add({ id: "size", level: "error", message: `Too long for Gmail: ${opts.size.toLocaleString()} of 10,000 characters. Remove a block or two.` });
    else if (opts.size > GMAIL_SIGNATURE_LIMIT * 0.85)
      add({ id: "size", level: "warning", message: `Close to Gmail's limit (${opts.size.toLocaleString()} of 10,000 characters).` });
  }
  const rank: Record<CheckLevel, number> = { error: 0, warning: 1, tip: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level]);
}

function checkBlocks(doc: SignatureDoc, root: Column, add: (i: CheckIssue) => void) {
  const design = doc.design;
  const fixB = (id: string, label = "Select block") => ({ tab: "blocks", blockId: id, label });
  // Background each block sits on (panels inherit to their contents).
  const bgOf = new Map<string, string>();
  const visit = (col: Column, bg: string) => {
    const colBg = col.box?.background ?? bg;
    for (const b of col.blocks) {
      const own = b.style?.box?.background ?? colBg;
      bgOf.set(b.id, own);
      if (b.type === "row") b.columns.forEach((c) => visit(c, own));
    }
  };
  visit(root, root.box?.background ?? "#ffffff");

  for (const { block: b } of walk(root)) {
    if (b.visibility === "hidden") continue;
    const bg = bgOf.get(b.id) ?? "#ffffff";
    const textual = ["name", "title", "field", "text", "contacts", "iconText", "quote", "signOff"].includes(b.type);
    if (textual) {
      const color = b.style?.color ?? (b.type === "title" ? design.muted : design.text);
      if (contrast(color, bg) < 3)
        add({
          id: `contrast-${b.id}`,
          level: "warning",
          message: `Text in a ${b.type === "text" ? "text block" : b.type} is hard to read on its background.`,
          fix: fixB(b.id, "Fix colour"),
        });
    }
    const size = b.style?.fontSize ?? (b.type === "text" ? b.size : undefined);
    if (size !== undefined && size * (design.scale ?? 1) < 10)
      add({ id: `small-${b.id}`, level: "warning", message: "Some text is smaller than 10px.", fix: fixB(b.id) });
    const badLink = (url: string | undefined, what: string) => {
      const lp = url ? linkProblem(url) : null;
      if (lp) add({ id: `link-${b.id}-${what}`, level: "error", message: `${what} link ${lp}`, fix: fixB(b.id, "Fix link") });
    };
    // Text links may also be an email address or a phone number.
    const badTarget = (raw: string | undefined, what: string) => {
      const s = raw?.trim();
      if (!s) return;
      const lp = /^[^\s@]+@[^\s@]+$/.test(s) ? emailProblem(s) : /^\+?[\d\s().-]{6,}$/.test(s) ? null : linkProblem(s);
      if (lp) add({ id: `link-${b.id}-${what}`, level: "error", message: `${what} ${lp}`, fix: fixB(b.id, "Fix link") });
    };
    if ("link" in b && b.type !== "image") badTarget(b.link, "The link on this block");
    if (b.type === "text") for (const m of b.text.matchAll(INLINE_LINK)) badTarget(m[2], `The link on “${m[1].slice(0, 24)}”`);
    switch (b.type) {
      case "button":
        badLink(b.url, `“${b.text || "Button"}”`);
        if (!b.url.trim() && !doc.details.website.trim())
          add({ id: `btn-${b.id}`, level: "warning", message: `“${b.text || "Button"}” has no link.`, fix: fixB(b.id, "Add a link") });
        break;
      case "image": {
        badLink(b.link, "Image");
        const gif = b.assetId ? gifIssue(doc.assets[b.assetId], b.aspect, b.crop, b.radius ? "rounded" : "square") : null;
        if (gif) add({ id: `gif-${b.id}`, level: "tip", message: gif, fix: fixB(b.id, "Select image") });
        if (!b.assetId) add({ id: `img-${b.id}`, level: "warning", message: "An image block is empty.", fix: fixB(b.id, "Add image") });
        else if (!b.alt?.trim())
          add({ id: `alt-${b.id}`, level: "tip", message: "Describe your image for people who can't see it.", fix: fixB(b.id, "Add description") });
        break;
      }
      case "logos":
        b.items.forEach((it, i) => badLink(it.link, `Logo ${i + 1}`));
        if (b.items.some((it) => it.assetId && !it.alt?.trim()))
          add({ id: `alt-${b.id}`, level: "tip", message: "Name the logos in your logo row for screen readers.", fix: fixB(b.id, "Add names") });
        break;
      case "qr":
        if (b.source === "custom") badLink(b.url, "QR code");
        break;
      case "iconText":
      case "tag":
        badLink(b.url, `“${b.text}”`);
        break;
      case "reviews":
        badLink(b.url, "Reviews");
        break;
      case "video":
        badLink(b.url, "Video");
        if (!b.assetId) add({ id: `vid-${b.id}`, level: "warning", message: "Your video block needs a thumbnail image.", fix: fixB(b.id, "Add thumbnail") });
        break;
    }
  }
}
