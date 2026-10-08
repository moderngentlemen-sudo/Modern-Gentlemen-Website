/**
 * Signature Studio 3 — signature document.
 *
 * A signature is a set of form-like sections (details, images, social,
 * design, add-ons, business card). A template decides the layout; the
 * design section restyles it. Everything a user enters survives template
 * switches because templates never own content.
 */

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
}

export interface AssetMeta {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
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
}

export type Variant = "full" | "reply";
