import { z } from "zod";
import { mediaOverlaySchema } from "./mediaOverlay";

/** New collections are presentation choices, separate from legacy template names. */
export const ARTICLE_DESIGN_PRESETS = [
  {
    id: "immersive",
    name: "Immersive Original",
    layout: "v01",
    group: "Editorial collection",
    description: "Expansive media and an overlapping reading panel.",
  },
  {
    id: "floating-folio",
    name: "Floating Folio",
    layout: "v02",
    group: "Editorial collection",
    description: "A centred title panel floats above the image.",
  },
  {
    id: "horizon",
    name: "Horizon",
    layout: "v03",
    group: "Editorial collection",
    description: "Panoramic media with a divided introduction.",
  },
  {
    id: "diptych",
    name: "Diptych",
    layout: "v04",
    group: "Editorial collection",
    description: "Two complementary photographs share the cover.",
  },
  {
    id: "gallery",
    name: "The Gallery",
    layout: "v05",
    group: "Editorial collection",
    description: "Inset media, paper margins, and curatorial captions.",
  },
  {
    id: "reverse-cover",
    name: "Reverse Cover",
    layout: "v06",
    group: "Editorial collection",
    description: "A tall image balances an offset reading column.",
  },
  {
    id: "portrait",
    name: "The Portrait",
    layout: "v07",
    group: "Editorial collection",
    description: "Expressive type and a tall portrait.",
  },
  {
    id: "architectural",
    name: "Architectural",
    layout: "v08",
    group: "Editorial collection",
    description: "A headline intersects an offset image window.",
  },
  {
    id: "marquee",
    name: "The Marquee",
    layout: "v09",
    group: "Editorial collection",
    description: "A statement headline and wide media band.",
  },
  {
    id: "nocturne",
    name: "Nocturne",
    layout: "v10",
    group: "Editorial collection",
    description: "A dark, letterboxed cover for photographs and film.",
  },
  {
    id: "photo-essay",
    name: "Photo Essay",
    layout: "v11",
    group: "Editorial collection",
    description: "Large image sequences and a caption rail.",
  },
  {
    id: "film-journal",
    name: "Film Journal",
    layout: "v12",
    group: "Editorial collection",
    description: "A contained screening area with an article index.",
  },
  {
    id: "conversation",
    name: "The Conversation",
    layout: "v13",
    group: "Editorial collection",
    description: "An asymmetric cover and spacious interview body.",
  },
  {
    id: "field-guide",
    name: "Field Guide",
    layout: "v14",
    group: "Editorial collection",
    description: "Numbered sections and an easy-to-scan index.",
  },
  {
    id: "curated-edit",
    name: "The Curated Edit",
    layout: "v15",
    group: "Editorial collection",
    description: "An editorial opening and numbered selections.",
  },
  {
    id: "timeline",
    name: "The Timeline",
    layout: "v16",
    group: "Editorial collection",
    description: "A centred cover with a continuous reading line.",
  },
  {
    id: "collector",
    name: "The Collector",
    layout: "v17",
    group: "Editorial collection",
    description: "An object study framed by discreet labels.",
  },
  {
    id: "editors-letter",
    name: "Editor’s Letter",
    layout: "v18",
    group: "Editorial collection",
    description: "A personal, typography-led composition.",
  },
  {
    id: "long-read",
    name: "The Long Read",
    layout: "v19",
    group: "Editorial collection",
    description: "Chapters, a reading index, and wide image breaks.",
  },
  {
    id: "double-exposure",
    name: "Double Exposure",
    layout: "v20",
    group: "Editorial collection",
    description: "A full cover and overlapping second photograph.",
  },
  {
    id: "study-journal",
    name: "The Journal",
    layout: "v21",
    group: "Earlier studies",
    description: "A classic headline, wide image, and calm body.",
  },
  {
    id: "study-cover",
    name: "Cover Story",
    layout: "v22",
    group: "Earlier studies",
    description: "A full-width photographic opening.",
  },
  {
    id: "study-split",
    name: "Split Feature",
    layout: "v23",
    group: "Earlier studies",
    description: "Title and photograph share equal space.",
  },
  {
    id: "study-profile",
    name: "The Profile",
    layout: "v24",
    group: "Earlier studies",
    description: "Portrait-led storytelling and a generous pull quote.",
  },
  {
    id: "study-photo",
    name: "Photo Essay — Original",
    layout: "v25",
    group: "Earlier studies",
    description: "A numbered photograph sequence above a concise body.",
  },
  {
    id: "study-guide",
    name: "The Field Guide — Original",
    layout: "v26",
    group: "Earlier studies",
    description: "A practical article index with short chapters.",
  },
  {
    id: "study-brief",
    name: "The Brief",
    layout: "v27",
    group: "Earlier studies",
    description: "Compact reporting with a small lead photograph.",
  },
  {
    id: "study-letter",
    name: "Editor’s Letter — Original",
    layout: "v28",
    group: "Earlier studies",
    description: "A centred, primarily typographic editorial.",
  },
  {
    id: "immersive-reference",
    name: "Immersive Reference",
    layout: "v29",
    group: "Reference study",
    description: "The original screenshot-inspired media and reading-sheet composition.",
  },
] as const;
export type ArticleDesignId = "inherit" | "legacy" | (typeof ARTICLE_DESIGN_PRESETS)[number]["id"];
export const articleDesignById = (id: string) => ARTICLE_DESIGN_PRESETS.find((p) => p.id === id);
const presetSchema = z.custom<ArticleDesignId>(
  (v) => v === "inherit" || v === "legacy" || ARTICLE_DESIGN_PRESETS.some((p) => p.id === v),
  "Choose an article design from the collection"
);
export const articleDesignSchema = z
  .object({
    preset: presetSchema,
    heroHeight: z.number().finite().min(240).max(1200).optional(),
    bodyWidth: z.number().finite().min(420).max(900).optional(),
    titleSize: z.number().finite().min(32).max(120).optional(),
    bodySize: z.number().finite().min(16).max(24).optional(),
    titleAlign: z.enum(["left", "center", "right"]).optional(),
    titleColor: z
      .string()
      .regex(/^#[a-f0-9]{6}$/i)
      .optional(),
    imageColor: z.boolean().optional(),
    mediaFit: z.enum(["cover", "contain"]).optional(),
    focalX: z.number().finite().min(0).max(100).optional(),
    focalY: z.number().finite().min(0).max(100).optional(),
    overlay: mediaOverlaySchema.optional(),
    autoplay: z.boolean().optional(),
    youtubeAutoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    controls: z.boolean().optional(),
    showPlayButton: z.boolean().optional(),
  })
  .strict();
export type ArticleDesign = z.infer<typeof articleDesignSchema>;
export const DEFAULT_ARTICLE_DESIGN: ArticleDesign = { preset: "legacy" };
export function readArticleDesign(value: unknown): ArticleDesign | undefined {
  const parsed = articleDesignSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export function resolveArticleDesign(
  global: ArticleDesign | undefined,
  local: ArticleDesign | undefined
): ArticleDesign {
  const base = global || DEFAULT_ARTICLE_DESIGN;
  return {
    ...base,
    ...Object.fromEntries(Object.entries(local || {}).filter(([, value]) => value !== undefined)),
    preset: !local || local.preset === "inherit" ? base.preset : local.preset,
  };
}

/** Metadata saved with the draft lets capability previews show the same article header. */
export const articleDesignPreviewSchema = z
  .object({
    slug: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    dek: z.string().max(10000).optional(),
    category: z.string().max(200).optional(),
    author: z.string().max(200).optional(),
    issue: z.string().max(100).optional(),
    read: z.number().min(1).max(180).optional(),
  })
  .strict();
export function articleDesignPreviewOf(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const hero = (payload as { hero?: { editorial?: unknown } }).hero;
  const parsed = articleDesignPreviewSchema.safeParse(hero?.editorial);
  return parsed.success ? parsed.data : undefined;
}
