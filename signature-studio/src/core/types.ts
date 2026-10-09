/**
 * Signature Studio 3 — signature document.
 *
 * A signature is a set of form-like sections (details, images, social,
 * design, add-ons, business card). A template decides the layout; the
 * design section restyles it. Everything a user enters survives template
 * switches because templates never own content.
 */

import type { ImageLook } from "./imageLook";

export const DOC_SCHEMA = "signature-studio.v3" as const;

export type DetailKey = "name" | "title" | "company" | "department" | "pronouns" | "phone" | "mobile" | "email" | "website" | "address";

export interface CustomField {
  id: string;
  label: string;
  value: string;
  link?: string;
}

export interface Details extends Record<DetailKey, string> {
  custom: CustomField[];
}

export type ImageShape = "square" | "rounded" | "circle";

export interface ImageSlot {
  assetId?: string;
  /** Display width in px. */
  size: number;
  shape: ImageShape;
  /** Pan/zoom framing inside the slot. */
  crop: { x: number; y: number; zoom: number };
  link?: string;
  /** Frame aspect (width / height); defaults to square for photos, the image's own for others. */
  aspect?: number;
  /** Frame, border, shadow and colour adjustments (core/imageLook.ts). */
  look?: ImageLook;
}

export interface Images {
  photo: ImageSlot;
  logo: ImageSlot;
}

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x"
  | "youtube"
  | "pinterest"
  | "threads"
  | "behance"
  | "dribbble"
  | "vimeo"
  | "github"
  | "custom";

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
}

export type IconShape = "circle" | "rounded" | "square" | "plain" | "outline";
export type IconColorMode = "brand" | "accent" | "mono";

export interface SocialStyle {
  shape: IconShape;
  size: number;
  colorMode: IconColorMode;
  gap: number;
}

export type ContactIcons = "icons" | "letters" | "words" | "none";

export interface Design {
  /** Main brand colour: name, icons, buttons. */
  accent: string;
  /** Body text. */
  text: string;
  /** Secondary text (title, labels). */
  muted: string;
  /** Optional panel colour for templates that use one. */
  surface: string;
  /** Font ids from the font library. */
  headingFont: string;
  bodyFont: string;
  /** Body size in px. */
  fontSize: number;
  /** Name size multiplier relative to body. */
  nameScale: number;
  /** 0.7–1.6 multiplier for gaps and padding. */
  spacing: number;
  contactIcons: ContactIcons;
  /** Show contact rows inline (one line) instead of stacked. */
  contactInline: boolean;
  divider: "line" | "none" | "accent" | "dots";
  align: "left" | "center";
  /** Max width in px. */
  width: number;
  social: SocialStyle;
  /** Name text transform. */
  nameCase: "normal" | "upper";
  /** Overall size of the signature (1 = as designed). Scales text, images, icons and spacing together. */
  scale?: number;
  /** Text direction. "rtl" mirrors the layout for Arabic, Hebrew, Persian and Urdu. */
  direction?: "ltr" | "rtl";
}

export interface AddOns {
  signOff: { enabled: boolean; text: string; script: boolean };
  cta: { enabled: boolean; text: string; url: string; style: "solid" | "outline" | "pill" | "link" };
  meeting: { enabled: boolean; text: string; url: string };
  banner: { enabled: boolean; assetId?: string; url: string; width: number; alt: string };
  quote: { enabled: boolean; text: string; author: string };
  reviews: { enabled: boolean; rating: number; text: string; url: string };
  video: { enabled: boolean; assetId?: string; url: string; title: string };
  apps: { enabled: boolean; appStore: string; googlePlay: string };
  disclaimer: { enabled: boolean; text: string };
  green: { enabled: boolean; text: string };
}

export type HotspotAction = "website" | "email" | "phone" | "mobile" | "meeting" | "digital-card" | "url" | SocialPlatform;

export interface Hotspot {
  id: string;
  /** Rect as fractions (0–1) of the card image. */
  x: number;
  y: number;
  w: number;
  h: number;
  action: HotspotAction;
  /** Only for action "url". */
  url?: string;
  label: string;
}

/**
 * Business card designed elsewhere (e.g. exported from Canva), made
 * clickable with hotspots and optionally published as a digital card.
 */
export interface BusinessCard {
  enabled: boolean;
  /**
   * "signature": a whole email signature designed in Canva (kept pixel-exact).
   * "card": a business card shown with (or instead of) the text signature.
   */
  kind: "signature" | "card";
  /** Use the design in the reply signature too (otherwise replies are text). */
  inReplies: boolean;
  assetId?: string;
  backAssetId?: string;
  /** Display width in the signature. */
  width: number;
  hotspots: Hotspot[];
  /** Replace the text signature with the card (true) or show both. */
  cardOnly: boolean;
  /** Add a "View my digital card" link + QR to the signature. */
  digitalLink: boolean;
  radius: number;
}

export interface ReplySettings {
  /** Reply signature: compact layout without images and add-ons. */
  compact: boolean;
  keepPhoto: boolean;
  keepLogo: boolean;
  keepSocial: boolean;
  /** Builder: replies use their own layout (`replyBlocks`) instead of the main one. */
  custom?: boolean;
}

export interface AssetMeta {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  /** Made from another asset by rotating, flipping or straightening it; editing starts again from that one. */
  origin?: AssetOrigin;
}

export interface AssetOrigin {
  id: string;
  rotate: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  /** Small rotation in degrees (−15…15), cropped to hide the corners. */
  straighten?: number;
}

export interface Published {
  url: string;
  hash: string;
  verifiedAt: number;
}

export interface SignatureDoc {
  schema: typeof DOC_SCHEMA;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  templateId: string;
  details: Details;
  images: Images;
  socials: SocialLink[];
  design: Design;
  addons: AddOns;
  card: BusinessCard;
  reply: ReplySettings;
  assets: Record<string, AssetMeta>;
  /** Verified public image URLs, keyed by image request key. */
  published: Record<string, Published>;
  /** Public digital-card page URL, once published. */
  digitalCardUrl?: string;
  /** Short card link (`/c/<slug>`) when signed in; the card behind it updates as the signature does. */
  cardSlug?: string;
  /** Public image URLs the digital card uses, kept so the short-link card can be refreshed without re-publishing. */
  cardImages?: { front?: string; back?: string; photo?: string };
  /** "quick": template + forms. "builder": the drag-and-drop layout in `blocks`. */
  mode?: "quick" | "builder";
  blocks?: Column;
  /** Builder: the reply layout, used when `reply.custom` is on. */
  replyBlocks?: Column;
  /** Show the small "Made with …" link under new-email signatures (default on). */
  madeWith?: boolean;
  /** Share details, social links and photo with your saved profile (default on). */
  useProfile?: boolean;
}

export type Variant = "full" | "reply";

// ---------------------------------------------------------------------------
// Builder: a free-form block layout (drag and drop). Email can't position
// things absolutely, so a layout is rows of columns of blocks — which maps
// one-to-one onto the tables every inbox understands.
// ---------------------------------------------------------------------------

export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";

/** Optional panel around a block or column. */
export interface Box {
  padding?: number;
  background?: string;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderSide?: "all" | "left" | "top" | "bottom";
}

/** Per-block overrides of the signature's design. */
export type TextCase = "none" | "upper" | "lower" | "title" | "smallcaps";

/** Which of the signature's colours text follows (a custom `color` wins). */
export type ColorRole = "text" | "muted" | "accent";

export interface BlockStyle {
  color?: string;
  colorRole?: ColorRole;
  /** 300–800. */
  weight?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  case?: TextCase;
  /** Line height as a multiple of the font size. */
  lineHeight?: number;
  /** Letter spacing in em. */
  tracking?: number;
  accent?: string;
  font?: string;
  fontSize?: number;
  align?: Align;
  box?: Box;
}

export interface Column {
  id: string;
  /** Fixed width in px; auto when unset. */
  width?: number;
  align?: Align;
  gap: number;
  blocks: Block[];
  box?: Box;
}

interface BlockBase {
  id: string;
  /** Which signature version shows the block (default: both); "hidden" keeps it but never shows it. */
  visibility?: "both" | "full" | "reply" | "hidden";
  style?: BlockStyle;
  /** Hover text: shown when someone points at the block's links or images. */
  hover?: string;
}

export type ButtonStyle = "solid" | "outline" | "pill" | "link" | "square" | "squareOutline";

export type Block = BlockBase &
  (
    | { type: "row"; columns: Column[]; gap: number; valign: VAlign; divider: boolean }
    | { type: "name"; scale?: number; upper?: boolean; underline?: boolean; link?: string }
    | { type: "title"; upper?: boolean; italic?: boolean; titleOnly?: boolean; link?: string }
    | { type: "field"; field: DetailKey; upper?: boolean; link?: string }
    | { type: "text"; text: string; size?: number; bold?: boolean; italic?: boolean; muted?: boolean; upper?: boolean; link?: string }
    | { type: "contacts"; layout: "stacked" | "inline" | "grid" | "chips"; iconBg?: boolean }
    | { type: "socials"; size?: number }
    | { type: "photo"; size?: number }
    | { type: "logo"; size?: number }
    | {
        type: "image";
        assetId?: string;
        width: number;
        link?: string;
        alt?: string;
        radius?: number;
        aspect?: number;
        crop?: { x: number; y: number; zoom: number };
        look?: ImageLook;
      }
    | { type: "logos"; items: { id: string; assetId?: string; link?: string; alt?: string }[]; height: number; gap: number }
    | { type: "qr"; source: "website" | "digitalCard" | "custom"; url: string; size: number; caption: string }
    | { type: "iconText"; icon: string; text: string; url: string; iconBg?: boolean }
    | { type: "tag"; text: string; url: string; filled: boolean; square?: boolean }
    | { type: "monogram"; size: number }
    | { type: "divider"; width?: number; thickness?: number }
    | { type: "spacer"; height: number }
    | { type: "button"; text: string; url: string; buttonStyle: ButtonStyle; icon?: "calendar" | "" }
    | { type: "signOff"; text: string; script: boolean }
    | { type: "quote"; text: string; author: string }
    | { type: "reviews"; rating: number; text: string; url: string }
    | { type: "video"; assetId?: string; url: string; title: string }
    | { type: "apps"; appStore: string; googlePlay: string }
    | { type: "digitalCard" }
    | { type: "canva" }
  );

export type BlockType = Block["type"];

/** A saved brand: applied to new signatures and on request to existing ones. */
export interface BrandKit {
  accent: string;
  text: string;
  muted: string;
  surface: string;
  headingFont: string;
  bodyFont: string;
  logo?: AssetMeta;
  /** Company name and website, prefilled into new signatures. */
  company?: string;
  website?: string;
}
