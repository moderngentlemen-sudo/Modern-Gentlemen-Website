/**
 * Templates built from builder blocks: twelve modern, sophisticated designs
 * and ten inspired by the Modern Gentlemen website (racing red #C8102E on
 * ink and paper, Space Grotesk, Instrument Serif italic accents, IBM Plex Mono
 * labels, sharp corners, solid red bands).
 *
 * Every block here binds to the user's own details — no placeholder copy.
 * Block factories are only called inside the recipes (never at module load),
 * which keeps the templates ↔ blocks import cycle safe.
 */
import { block, col, panel, rowOf } from "./blocks";
import type { Spec } from "./templates";
import type { Design, IconShape } from "./types";

const social = (shape: IconShape, colorMode: Design["social"]["colorMode"] = "accent", size = 20) => ({ shape, colorMode, size });

// ---------------------------------------------------------------------------
// Modern, sophisticated
// ---------------------------------------------------------------------------

export const MODERN_SPECS: Spec[] = [
  {
    id: "modern-atelier",
    name: "Atelier",
    group: "Modern",
    category: "Minimal",
    description: "Quiet type, a short accent rule, one line of contacts.",
    layout: "stacked",
    design: {
      accent: "#111111",
      text: "#111111",
      muted: "#8a8a8a",
      headingFont: "inter",
      bodyFont: "inter",
      contactIcons: "none",
      divider: "accent",
      social: social("plain", "mono", 16),
    },
    blocks: () => [
      block("name", { scale: 1.15 }),
      block("title"),
      block("divider", { width: 32, thickness: 2 }),
      block("contacts", { layout: "inline" }),
      block("socials"),
    ],
  },
  {
    id: "modern-quiet-luxury",
    name: "Quiet Luxury",
    group: "Modern",
    category: "Luxury",
    description: "Centred serif, champagne monogram, generous space.",
    layout: "centered",
    design: {
      accent: "#a68a5b",
      text: "#1c1a17",
      muted: "#8a8074",
      headingFont: "cormorant",
      bodyFont: "jost",
      align: "center",
      contactIcons: "none",
      social: social("outline", "accent", 18),
    },
    blocks: () => [
      block("monogram", { size: 52 }),
      block("name", { scale: 1.6, style: { align: "center" } }),
      block("title", { upper: true, style: { align: "center" } }),
      block("divider", { width: 40 }),
      block("contacts", { layout: "inline", style: { align: "center" } }),
      block("socials", { style: { align: "center" } }),
    ],
  },
  {
    id: "modern-graphite",
    name: "Graphite",
    group: "Modern",
    category: "Dark",
    description: "A deep graphite panel with warm gold details.",
    layout: "card",
    design: {
      accent: "#e8b86d",
      text: "#18181b",
      muted: "#a1a1aa",
      surface: "#17171a",
      headingFont: "inter",
      bodyFont: "inter",
      social: social("circle", "accent", 20),
    },
    blocks: () => [
      panel(
        [
          rowOf(
            [
              col([block("photo", { size: 72 })]),
              col(
                [
                  block("name", { style: { color: "#ffffff" } }),
                  block("title", { style: { color: "#a1a1aa" } }),
                  block("contacts", { style: { color: "#e4e4e7" } }),
                  block("socials"),
                ],
                { gap: 6 },
              ),
            ],
            { gap: 18, valign: "middle" },
          ),
        ],
        { background: "#17171a", padding: 20, radius: 6 },
      ),
    ],
  },
  {
    id: "modern-slate",
    name: "Slate Split",
    group: "Modern",
    category: "Executive",
    description: "Who you are on the left, how to reach you on the right.",
    layout: "split3",
    design: { accent: "#334155", text: "#0f172a", muted: "#64748b", headingFont: "work-sans", bodyFont: "work-sans", social: social("rounded", "accent", 18) },
    blocks: () => [
      rowOf(
        [
          col([block("name", { scale: 1.2 }), block("title", { titleOnly: true }), block("field", { field: "company", upper: true })], { gap: 4 }),
          col([block("contacts"), block("socials")], { gap: 8 }),
        ],
        { divider: true, gap: 22, valign: "middle" },
      ),
    ],
  },
  {
    id: "modern-gallery",
    name: "Gallery",
    group: "Modern",
    category: "Editorial",
    description: "Square portrait, gallery-label company, serif name.",
    layout: "classic",
    design: {
      accent: "#8c6d4f",
      text: "#1f1a16",
      muted: "#7b7067",
      headingFont: "fraunces",
      bodyFont: "helvetica",
      contactIcons: "letters",
      social: social("plain", "mono", 16),
    },
    photo: { shape: "square", size: 96 },
    blocks: () => [
      rowOf(
        [
          col([block("photo", { size: 96 })]),
          col(
            [
              block("field", { field: "company", upper: true, style: { font: "ibm-plex-mono" } }),
              block("name", { scale: 1.3 }),
              block("title", { italic: true, titleOnly: true }),
              block("contacts", { style: { fontSize: 12 } }),
            ],
            { gap: 4 },
          ),
        ],
        { gap: 18 },
      ),
    ],
  },
  {
    id: "modern-noir-gold",
    name: "Noir & Gold",
    group: "Modern",
    category: "Luxury",
    description: "Black lacquer, gold rule, a statement serif.",
    layout: "card",
    design: {
      accent: "#c9a45c",
      text: "#111111",
      muted: "#a3a3a3",
      surface: "#0f0f10",
      headingFont: "playfair",
      bodyFont: "helvetica",
      contactIcons: "none",
      divider: "accent",
      social: social("outline", "accent", 18),
    },
    blocks: () => [
      panel(
        [
          block("title", { upper: true, titleOnly: true, style: { color: "#c9a45c" } }),
          block("name", { scale: 1.5, style: { color: "#ffffff" } }),
          block("divider", { width: 40, thickness: 1 }),
          block("contacts", { layout: "inline", style: { color: "#d4d4d8" } }),
          block("socials"),
        ],
        { background: "#0f0f10", padding: 22, radius: 2 },
        8,
      ),
    ],
  },
  {
    id: "modern-studio-mono",
    name: "Studio Mono",
    group: "Modern",
    category: "Studio",
    description: "Monospace precision with an electric-blue accent.",
    layout: "editorial",
    design: {
      accent: "#0047ff",
      text: "#0a0a0a",
      muted: "#666666",
      headingFont: "ibm-plex-mono",
      bodyFont: "ibm-plex-mono",
      fontSize: 12,
      contactIcons: "letters",
      divider: "dots",
      social: social("square", "accent", 16),
    },
    blocks: () => [
      block("field", { field: "company", upper: true }),
      block("name", { scale: 1.3 }),
      block("title", { titleOnly: true }),
      block("divider", { width: 220 }),
      block("contacts"),
      block("socials"),
    ],
  },
  {
    id: "modern-sage",
    name: "Sage",
    group: "Modern",
    category: "Minimal",
    description: "A soft sage card with rounded corners.",
    layout: "card",
    design: {
      accent: "#3f6b4f",
      text: "#1d2b22",
      muted: "#6b7d70",
      surface: "#eef2ec",
      headingFont: "inter",
      bodyFont: "inter",
      social: social("circle", "accent", 18),
    },
    blocks: () => [
      panel(
        [
          rowOf([col([block("photo", { size: 64 })]), col([block("name"), block("title"), block("contacts"), block("socials")], { gap: 5 })], {
            gap: 16,
            valign: "middle",
          }),
        ],
        { background: "#eef2ec", padding: 18, radius: 14 },
      ),
    ],
  },
  {
    id: "modern-midnight",
    name: "Midnight",
    group: "Modern",
    category: "Executive",
    description: "A navy edge, contacts in a tidy grid, logo beneath.",
    layout: "sidebar",
    design: { accent: "#1e3a8a", text: "#0f172a", muted: "#5b6b80", headingFont: "montserrat", bodyFont: "helvetica", social: social("square", "accent", 18) },
    blocks: () => [
      rowOf(
        [
          col([block("name"), block("title"), block("contacts", { layout: "grid" }), block("socials")], {
            gap: 6,
            box: { borderWidth: 3, borderColor: "#1e3a8a", borderSide: "left", padding: 14 },
          }),
        ],
        { gap: 0 },
      ),
      block("logo", { size: 96 }),
    ],
  },
  {
    id: "modern-architect",
    name: "Architect",
    group: "Modern",
    category: "Studio",
    description: "Spaced capitals and hairlines, like a drawing title block.",
    layout: "grid",
    design: {
      accent: "#3a3a3a",
      text: "#1a1a1a",
      muted: "#7a7a7a",
      headingFont: "jost",
      bodyFont: "jost",
      contactIcons: "letters",
      nameCase: "upper",
      social: social("square", "mono", 16),
    },
    blocks: () => [
      block("name", { upper: true, scale: 1.1 }),
      block("title", { upper: true }),
      block("divider"),
      block("contacts", { layout: "grid" }),
      block("socials"),
    ],
  },
  {
    id: "modern-executive",
    name: "Executive",
    group: "Modern",
    category: "Executive",
    description: "Logo first, a clean rule, and a call to action.",
    layout: "stacked",
    design: { accent: "#0f3d3e", text: "#102a2b", muted: "#5d7273", headingFont: "work-sans", bodyFont: "work-sans", social: social("circle", "accent", 18) },
    blocks: () => [
      block("logo", { size: 120 }),
      block("divider"),
      block("name", { scale: 1.2 }),
      block("title"),
      block("contacts", { layout: "inline" }),
      rowOf([col([block("button", { text: "Visit website", buttonStyle: "outline" })]), col([block("socials")])], { gap: 16, valign: "middle" }),
    ],
  },
  {
    id: "modern-signature",
    name: "Signed",
    group: "Modern",
    category: "Editorial",
    description: "A handwritten sign-off above a refined serif name.",
    layout: "editorial",
    design: {
      accent: "#6b4f3a",
      text: "#2a211b",
      muted: "#80705f",
      headingFont: "libre-baskerville",
      bodyFont: "georgia",
      contactIcons: "none",
      social: social("plain", "accent", 16),
    },
    blocks: () => [
      block("signOff", { text: "Kind regards,", script: true }),
      block("name", { scale: 1.1 }),
      block("title", { italic: true }),
      block("contacts", { layout: "inline", style: { fontSize: 12 } }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Inspired by the Modern Gentlemen website
// ---------------------------------------------------------------------------

const RED = "#c8102e";
const RED_ON_DARK = "#f7142e";
const INK = "#141414";
const GREY = "#5a5a5a";
const PAPER = "#f4f4f4";
const DARK = "#0d0d0d";

const MG: Spec["design"] = {
  accent: RED,
  text: INK,
  muted: GREY,
  surface: PAPER,
  headingFont: "space-grotesk",
  bodyFont: "space-grotesk",
  fontSize: 13,
  nameScale: 1.5,
  contactIcons: "letters",
  divider: "line",
  social: social("square", "mono", 18),
};

/** Mono, uppercase, letter-spaced label — the site's kicker style. */
const label = (color?: string) => block("field", { field: "company", upper: true, style: { font: "ibm-plex-mono", ...(color ? { color } : {}) } });
/** Instrument Serif italic — the site's editorial accent. */
const serifTitle = (color = RED, fontSize = 15) => block("title", { italic: true, titleOnly: true, style: { font: "instrument-serif", color, fontSize } });
const monoContacts = (o: { color?: string; layout?: "stacked" | "inline" | "grid" } = {}) =>
  block("contacts", { layout: o.layout ?? "stacked", style: { font: "ibm-plex-mono", fontSize: 11, ...(o.color ? { color: o.color } : {}) } });

export const MG_SPECS: Spec[] = [
  {
    id: "mg-debrief",
    name: "The Debrief",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "A solid racing-red band, like the site's call-to-action.",
    layout: "banner",
    design: { ...MG },
    blocks: () => [
      panel([block("name", { style: { color: "#ffffff" } }), label("#ffffff")], { background: RED, padding: 20, radius: 0 }, 6),
      monoContacts({ layout: "inline" }),
      block("socials"),
    ],
  },
  {
    id: "mg-editorial",
    name: "Editorial",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "Serif eyebrow, bold grotesk name, mono company line.",
    layout: "editorial",
    design: { ...MG },
    blocks: () => [
      serifTitle(),
      block("name", { scale: 1.3 }),
      label(),
      block("divider", { width: 280 }),
      monoContacts({ layout: "inline" }),
      block("socials"),
    ],
  },
  {
    id: "mg-membership",
    name: "Membership",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "Centred like the membership page, with a square red button.",
    layout: "centered",
    design: { ...MG, align: "center" },
    blocks: () => [
      label(),
      block("name", { scale: 1.6, style: { align: "center" } }),
      serifTitle(GREY, 16),
      monoContacts({ layout: "inline" }),
      block("button", { text: "Visit website →", buttonStyle: "square" }),
    ],
  },
  {
    id: "mg-noir",
    name: "Noir",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "The site's dark band: ink panel, bright red ink, paper text.",
    layout: "card",
    design: { ...MG, surface: DARK },
    blocks: () => [
      panel(
        [
          label(RED_ON_DARK),
          block("name", { scale: 1.1, style: { color: PAPER } }),
          serifTitle("#d4d4d4"),
          monoContacts({ color: PAPER, layout: "inline" }),
          block("socials", { style: { color: PAPER } }),
        ],
        { background: DARK, padding: 22, radius: 0 },
        7,
      ),
    ],
  },
  {
    id: "mg-racing-stripe",
    name: "Racing Stripe",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "A red stripe down the side, logo to the right.",
    layout: "sidebar",
    design: { ...MG },
    blocks: () => [
      rowOf(
        [
          col([block("name"), serifTitle(GREY, 14), monoContacts(), block("socials")], {
            gap: 6,
            box: { borderWidth: 4, borderColor: RED, borderSide: "left", padding: 14 },
          }),
          col([block("logo", { size: 90 })]),
        ],
        { gap: 18, valign: "middle" },
      ),
    ],
  },
  {
    id: "mg-monochrome",
    name: "Monochrome",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "Black and white, square portrait, one short red rule.",
    layout: "classic",
    design: { ...MG, accent: INK, divider: "accent" },
    photo: { shape: "square", size: 80 },
    blocks: () => [
      rowOf(
        [
          col([block("photo", { size: 80 })]),
          col(
            [
              block("name"),
              block("title", { upper: true, style: { font: "ibm-plex-mono", fontSize: 10 } }),
              block("divider", { width: 24, thickness: 3, style: { accent: RED } }),
              monoContacts(),
              block("socials"),
            ],
            { gap: 6 },
          ),
        ],
        { gap: 18 },
      ),
    ],
  },
  {
    id: "mg-film",
    name: "Film",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "Portrait and story-card type, like the culture features.",
    layout: "photoRight",
    design: { ...MG },
    photo: { shape: "square", size: 88 },
    blocks: () => [
      rowOf(
        [col([block("photo", { size: 88 })]), col([serifTitle(), block("name", { scale: 1.2 }), label(GREY), monoContacts({ layout: "inline" })], { gap: 4 })],
        { gap: 18, valign: "middle" },
      ),
    ],
  },
  {
    id: "mg-the-edit",
    name: "The Edit",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "Store-style: details, then a square red call to action.",
    layout: "stacked",
    design: { ...MG },
    blocks: () => [
      block("name"),
      serifTitle(GREY, 14),
      monoContacts(),
      rowOf([col([block("button", { text: "Visit website →", buttonStyle: "square" })]), col([block("socials")])], { gap: 16, valign: "middle" }),
    ],
  },
  {
    id: "mg-index",
    name: "Index",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "A spec-sheet grid of contacts in IBM Plex Mono.",
    layout: "grid",
    design: { ...MG },
    blocks: () => [label(), block("name", { scale: 1.2 }), block("divider"), monoContacts({ layout: "grid" }), block("socials")],
  },
  {
    id: "mg-card",
    name: "Card",
    group: "Modern Gentlemen",
    category: "Modern Gentlemen",
    description: "A sharp white card with a hairline ink border.",
    layout: "card",
    design: { ...MG, divider: "accent" },
    blocks: () => [
      panel(
        [label(), block("name"), serifTitle(GREY, 15), block("divider", { width: 32, thickness: 2 }), monoContacts(), block("socials")],
        { background: "#ffffff", padding: 20, radius: 0, borderWidth: 1, borderColor: INK, borderSide: "all" },
        6,
      ),
    ],
  },
];
