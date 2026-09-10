import { z } from "zod";
/** Approved MG collections. Stable ids are persisted; no prototype content is shipped. */
export const SEARCH_LAYOUT_PRESETS = [
  {
    id: "refined-original",
    name: "Refined original",
    description:
      "Same dark overlay and editorial/store groups. Tighter spacing, stable results, and a short first list.",
    group: "MG refinements",
    study: 1,
    fullscreen: false,
  },
  {
    id: "one-clear-list",
    name: "One clear list",
    description:
      "Editorial and store results share one list, with clear source labels and fewer repeated headings.",
    group: "MG refinements",
    study: 2,
    fullscreen: false,
  },
  {
    id: "editorial-store",
    name: "Editorial / Store",
    description:
      "Two counted tabs show one collection at a time. A simpler scan, with fewer rows on screen.",
    group: "MG refinements",
    study: 3,
    fullscreen: false,
  },
  {
    id: "compact-overlay",
    name: "Compact overlay",
    description:
      "The familiar search sits in a smaller central panel. Two results per group keep it focused.",
    group: "MG refinements",
    study: 4,
    fullscreen: false,
  },
  {
    id: "header-shelf",
    name: "Header shelf",
    description:
      "Search opens directly below the existing header. Editorial and store sit side by side on desktop.",
    group: "MG refinements",
    study: 5,
    fullscreen: false,
  },
  {
    id: "side-drawer",
    name: "Side drawer",
    description:
      "A narrow search panel keeps the current page in view, with one comfortable column of results.",
    group: "MG refinements",
    study: 6,
    fullscreen: false,
  },
  {
    id: "quick-index",
    name: "Quick index",
    description:
      "A text-only result index removes thumbnails. Clear source labels and keyboard navigation do the work.",
    group: "MG refinements",
    study: 7,
    fullscreen: false,
  },
  {
    id: "query-shortcuts",
    name: "Query shortcuts",
    description:
      "Specific query suggestions appear first. Choose one, or press Enter to see matching results.",
    group: "MG refinements",
    study: 8,
    fullscreen: false,
  },
  {
    id: "topic-shortcuts",
    name: "Topic shortcuts",
    description:
      "A compact topic row narrows the current results. Categories appear only when they contain matches.",
    group: "MG refinements",
    study: 9,
    fullscreen: false,
  },
  {
    id: "best-match",
    name: "Best match",
    description:
      "One leading match gets the image and attention. The remaining results use quieter, text-only rows.",
    group: "MG refinements",
    study: 10,
    fullscreen: false,
  },
  {
    id: "preview-on-demand",
    name: "Preview on demand",
    description:
      "Select a text result to reveal its image and excerpt. Keep your search while checking its relevance.",
    group: "MG refinements",
    study: 11,
    fullscreen: false,
  },
  {
    id: "three-at-a-time",
    name: "Three at a time",
    description:
      "A small first batch keeps results light. Reveal the next three only when you need them.",
    group: "MG refinements",
    study: 12,
    fullscreen: false,
  },
  {
    id: "context-preview",
    name: "Context preview",
    description:
      "A familiar split pane highlights matching words, helping you see why an editorial or store result is relevant.",
    group: "Preview on Demand",
    study: 1,
    fullscreen: false,
  },
  {
    id: "inline-reveal",
    name: "Inline reveal",
    description:
      "The preview expands directly below its result. One open item keeps your place in a single column.",
    group: "Preview on Demand",
    study: 2,
    fullscreen: false,
  },
  {
    id: "visual-spotlight",
    name: "Visual spotlight",
    description:
      "A narrow text index gives the selected image more space. The preview becomes the main editorial moment.",
    group: "Preview on Demand",
    study: 3,
    fullscreen: false,
  },
  {
    id: "preview-shelf",
    name: "Preview shelf",
    description:
      "A compact result grid sits above one wide preview. Image and description share a horizontal shelf.",
    group: "Preview on Demand",
    study: 4,
    fullscreen: false,
  },
  {
    id: "instant-peek",
    name: "Instant peek",
    description:
      "Hover briefly or focus a result to preview it. Tap selects on mobile; opening the page is always a separate action.",
    group: "Preview on Demand",
    study: 5,
    fullscreen: false,
  },
  {
    id: "words-first",
    name: "Words first",
    description:
      "Lead with the title, excerpt, and product price. Reveal the image only when you want a closer look.",
    group: "Preview on Demand",
    study: 6,
    fullscreen: false,
  },
  {
    id: "two-collections",
    name: "Two collections",
    description:
      "Editorial and Store have dedicated tabs and remembered selections. The shared preview adapts to each collection.",
    group: "Preview on Demand",
    study: 7,
    fullscreen: false,
  },
  {
    id: "product-essentials",
    name: "Product essentials",
    description:
      "A store-focused preview adds price and concise product details. Editorial results still receive a story preview.",
    group: "Preview on Demand",
    study: 8,
    fullscreen: false,
  },
  {
    id: "compare-alongside",
    name: "Compare alongside",
    description:
      "Keep one preview beside the next selection to compare prices, details, or stories without losing your query.",
    group: "Preview on Demand",
    study: 9,
    fullscreen: false,
  },
  {
    id: "preview-trail",
    name: "Preview trail",
    description:
      "A short history returns you to previously viewed items while preserving your current query.",
    group: "Preview on Demand",
    study: 10,
    fullscreen: false,
  },
  {
    id: "atelier",
    name: "Atelier",
    description:
      "FULL SCREEN · A spacious split workspace pairs a quiet result index with an image, excerpt, and product details.",
    group: "Preview on Demand",
    study: 11,
    fullscreen: true,
  },
  {
    id: "cinema",
    name: "Cinema",
    description:
      "FULL SCREEN · The selected image becomes a cinematic preview, with readable text and a separate open action.",
    group: "Preview on Demand",
    study: 12,
    fullscreen: true,
  },
  {
    id: "focus",
    name: "Focus",
    description:
      "FULL SCREEN · Choose a result, then inspect one generous preview. Return to the same list or step through results.",
    group: "Preview on Demand",
    study: 13,
    fullscreen: true,
  },
  {
    id: "showroom",
    name: "Showroom",
    description:
      "FULL SCREEN · A compact grid of store results sits beside a detailed product preview. Editorial search remains available.",
    group: "Preview on Demand",
    study: 14,
    fullscreen: true,
  },
  {
    id: "reading-room",
    name: "Reading room",
    description:
      "FULL SCREEN · The selected story or product leads the view; a short result index sits below it for continued discovery.",
    group: "Preview on Demand",
    study: 15,
    fullscreen: true,
  },
] as const;
export type SearchLayoutId = "legacy" | (typeof SEARCH_LAYOUT_PRESETS)[number]["id"];
export const SEARCH_MOTION_PRESETS = [
  {
    id: "quiet-rise",
    name: "Quiet rise",
    openMs: 240,
    closeMs: 180,
    description: "A short upward arrival, followed by a restrained return.",
  },
  {
    id: "soft-settle",
    name: "Soft settle",
    openMs: 300,
    closeMs: 210,
    description: "A gentle scale change settles the search into place.",
  },
  {
    id: "header-glide",
    name: "Header glide",
    openMs: 320,
    closeMs: 230,
    description: "The search descends from the header and retracts along the same path.",
  },
  {
    id: "focus-resolve",
    name: "Focus resolve",
    openMs: 320,
    closeMs: 220,
    description: "A slight softness resolves as the panel comes forward.",
  },
  {
    id: "quick-reveal",
    name: "Quick reveal",
    openMs: 170,
    closeMs: 130,
    description: "A four-pixel entrance keeps the interaction crisp and understated.",
  },
  {
    id: "from-the-left",
    name: "From the left",
    openMs: 340,
    closeMs: 240,
    description: "The search arrives from the left and returns to that edge.",
  },
  {
    id: "from-the-right",
    name: "From the right",
    openMs: 340,
    closeMs: 240,
    description: "A lateral arrival connects the panel to the search icon.",
  },
  {
    id: "lower-drawer",
    name: "Lower drawer",
    openMs: 380,
    closeMs: 260,
    description: "The panel lifts from below, then slides back down to close.",
  },
  {
    id: "diagonal-drift",
    name: "Diagonal drift",
    openMs: 350,
    closeMs: 240,
    description: "A small diagonal movement gives the entrance a directional quality.",
  },
  {
    id: "counter-glide",
    name: "Counter glide",
    openMs: 410,
    closeMs: 280,
    description: "The surface and its contents move in opposite directions, then settle together.",
  },
  {
    id: "top-curtain",
    name: "Top curtain",
    openMs: 380,
    closeMs: 270,
    description: "A clean mask reveals the search downward from the header.",
  },
  {
    id: "side-curtain",
    name: "Side curtain",
    openMs: 400,
    closeMs: 280,
    description: "The search reveals horizontally, without moving the text itself.",
  },
  {
    id: "center-aperture",
    name: "Center aperture",
    openMs: 410,
    closeMs: 290,
    description: "Two edges open from the center, then meet again on close.",
  },
  {
    id: "horizon-reveal",
    name: "Horizon reveal",
    openMs: 410,
    closeMs: 290,
    description: "The panel opens above and below a central horizontal line.",
  },
  {
    id: "icon-iris",
    name: "Icon iris",
    openMs: 450,
    closeMs: 310,
    description: "A circular reveal grows from the search icon and returns to it.",
  },
  {
    id: "falling-cadence",
    name: "Falling cadence",
    openMs: 460,
    closeMs: 300,
    description: "Results arrive in a short downward sequence; closing reverses their order.",
  },
  {
    id: "lateral-cadence",
    name: "Lateral cadence",
    openMs: 450,
    closeMs: 300,
    description: "Rows enter one after another with a subtle sideways movement.",
  },
  {
    id: "center-outward",
    name: "Center outward",
    openMs: 460,
    closeMs: 310,
    description: "The middle results lead, followed by the outer rows.",
  },
  {
    id: "preview-first",
    name: "Preview first",
    openMs: 470,
    closeMs: 310,
    description: "The visual preview appears first, with the result index following.",
  },
  {
    id: "query-first",
    name: "Query first",
    openMs: 430,
    closeMs: 290,
    description: "The search field leads, followed by results and the selected preview.",
  },
  {
    id: "accent-rule",
    name: "Accent rule",
    openMs: 440,
    closeMs: 300,
    description: "A fine red line opens across the header before the panel reveals.",
  },
  {
    id: "search-origin",
    name: "Search origin",
    openMs: 460,
    closeMs: 310,
    description: "A compact rectangle expands outward from the search control.",
  },
  {
    id: "navigation-handoff",
    name: "Navigation handoff",
    openMs: 420,
    closeMs: 280,
    description: "Navigation recedes as the search arrives, then returns as it closes.",
  },
  {
    id: "page-depth",
    name: "Page depth",
    openMs: 430,
    closeMs: 300,
    description: "The page draws back slightly while the search comes forward.",
  },
  {
    id: "header-lift",
    name: "Header lift",
    openMs: 410,
    closeMs: 280,
    description: "A small header lift accompanies the search, then both return together.",
  },
  {
    id: "image-settle",
    name: "Image settle",
    openMs: 460,
    closeMs: 300,
    description: "The image gently resolves into its frame before the preview text arrives.",
  },
  {
    id: "folio-turn",
    name: "Folio turn",
    openMs: 440,
    closeMs: 290,
    description: "A shallow perspective turn gives the surface a quiet editorial feel.",
  },
  {
    id: "soft-spring",
    name: "Soft spring",
    openMs: 420,
    closeMs: 250,
    description: "A tiny overshoot settles quickly; closing takes a direct path.",
  },
  {
    id: "editorial-strips",
    name: "Editorial strips",
    openMs: 470,
    closeMs: 310,
    description: "The field, rows, and preview reveal in opposing masked strips.",
  },
  {
    id: "mg-signature",
    name: "MG signature",
    openMs: 540,
    closeMs: 340,
    description: "A coordinated red rule, search field, result sequence, and image reveal.",
  },
] as const;
export type SearchMotionId = "legacy" | "none" | (typeof SEARCH_MOTION_PRESETS)[number]["id"];
export const searchLayoutById = (id: string) => SEARCH_LAYOUT_PRESETS.find((p) => p.id === id);
export const searchMotionById = (id: string) => SEARCH_MOTION_PRESETS.find((p) => p.id === id);

export interface SearchAppearance {
  layout: SearchLayoutId;
  motion: SearchMotionId;
  appearance: "site" | "light" | "dark";
  initialResults: number;
  debounceMs: number;
}
export const DEFAULT_SEARCH_APPEARANCE: SearchAppearance = {
  layout: "legacy",
  motion: "legacy",
  appearance: "site",
  initialResults: 6,
  debounceMs: 180,
};

export const searchAppearanceSchema = z
  .object({
    layout: z.custom<SearchLayoutId>(
      (v) => v === "legacy" || SEARCH_LAYOUT_PRESETS.some((p) => p.id === v)
    ),
    motion: z.custom<SearchMotionId>(
      (v) => v === "legacy" || v === "none" || SEARCH_MOTION_PRESETS.some((p) => p.id === v)
    ),
    appearance: z.enum(["site", "light", "dark"]),
    initialResults: z.number().int().min(3).max(12),
    debounceMs: z.number().int().min(80).max(500),
  })
  .strict();
export function readSearchAppearance(value: unknown): SearchAppearance {
  const parsed = searchAppearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SEARCH_APPEARANCE;
}
