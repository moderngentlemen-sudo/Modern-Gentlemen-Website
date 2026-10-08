import { uid } from "../lib/id";
import type { AddOns, BusinessCard, Design, Details, Images, SignatureDoc } from "./types";
import { DOC_SCHEMA } from "./types";

export const emptyDetails = (): Details => ({
  name: "",
  title: "",
  company: "",
  department: "",
  pronouns: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  address: "",
  custom: [],
});

export const SAMPLE_DETAILS: Details = {
  name: "Jordan Ellis",
  title: "Creative Director",
  company: "Modern Gentlemen",
  department: "",
  pronouns: "",
  phone: "+1 416 555 0182",
  mobile: "",
  email: "jordan@moderngentlemen.co",
  website: "moderngentlemen.co",
  address: "88 Yorkville Ave, Toronto",
  custom: [],
};

export const DEFAULT_DESIGN: Design = {
  accent: "#5b4cf0",
  text: "#1d1b2c",
  muted: "#6b6880",
  surface: "#f4f2ff",
  headingFont: "helvetica",
  bodyFont: "helvetica",
  fontSize: 13,
  nameScale: 1.45,
  spacing: 1,
  contactIcons: "icons",
  contactInline: false,
  divider: "line",
  align: "left",
  width: 520,
  social: { shape: "circle", size: 22, colorMode: "accent", gap: 6 },
  nameCase: "normal",
};

export const defaultImages = (): Images => ({
  photo: { size: 84, shape: "circle", crop: { x: 0, y: 0, zoom: 1 } },
  logo: { size: 110, shape: "square", crop: { x: 0, y: 0, zoom: 1 } },
});

export const defaultAddOns = (): AddOns => ({
  signOff: { enabled: false, text: "Best regards,", script: true },
  cta: { enabled: false, text: "Visit our website", url: "", style: "solid" },
  meeting: { enabled: false, text: "Book a meeting", url: "" },
  banner: { enabled: false, url: "", width: 460, alt: "" },
  quote: { enabled: false, text: "Design is intelligence made visible.", author: "Alina Wheeler" },
  reviews: { enabled: false, rating: 5, text: "Read our reviews", url: "" },
  video: { enabled: false, url: "", title: "Watch our story" },
  apps: { enabled: false, appStore: "", googlePlay: "" },
  disclaimer: { enabled: false, text: "This email and any attachments are confidential and intended solely for the addressee." },
  green: { enabled: false, text: "Please consider the environment before printing this email." },
});

export const defaultCard = (): BusinessCard => ({
  enabled: false,
  kind: "card",
  inReplies: false,
  width: 420,
  hotspots: [],
  cardOnly: false,
  digitalLink: true,
  radius: 12,
});

export function newDoc(templateId: string, design: Design, name = "My signature"): SignatureDoc {
  const now = Date.now();
  return {
    schema: DOC_SCHEMA,
    id: uid("sig"),
    name,
    createdAt: now,
    updatedAt: now,
    templateId,
    details: emptyDetails(),
    images: defaultImages(),
    socials: [],
    design: structuredClone(design),
    addons: defaultAddOns(),
    card: defaultCard(),
    reply: { compact: true, keepPhoto: false, keepLogo: true, keepSocial: false },
    assets: {},
    published: {},
  };
}

export const SAMPLE_SOCIALS = () => [
  { id: uid("s"), platform: "linkedin" as const, url: "https://linkedin.com/company/moderngentlemen" },
  { id: uid("s"), platform: "instagram" as const, url: "https://instagram.com/moderngentlemen" },
  { id: uid("s"), platform: "x" as const, url: "https://x.com/moderngentlemen" },
];
