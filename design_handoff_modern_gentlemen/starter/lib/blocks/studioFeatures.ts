import { mediaOverlayFields } from "./mediaOverlayFields";
import { mediaOverlaySchema, type MediaOverlay } from "@/lib/domain/mediaOverlay";
import { FONT_LIBRARY } from "@/lib/domain/fontLibrary";
import { field, fieldSetToZod, options, type FieldSet } from "./fields";
import { studioColor, studioDestination } from "./studioValues";

export interface StudioVideoOptions {
  autoplay?: boolean;
  repeat?: boolean;
  muted?: boolean;
  controls?: boolean;
  showToggle?: boolean;
  preload?: "none" | "metadata" | "auto";
}
export const studioVideoFields: FieldSet = {
  autoplay: field.boolean({ label: "Autoplay", default: false }),
  repeat: field.boolean({ label: "Repeat", default: false }),
  muted: field.boolean({ label: "Mute audio", default: true }),
  controls: field.boolean({ label: "Playback controls", default: true }),
  showToggle: field.boolean({ label: "Corner play / pause", default: true }),
  preload: field.select({
    label: "Preload",
    options: options("none", "metadata", "auto"),
    default: "metadata",
  }),
};
export function normalizeStudioVideo(raw: unknown, loop: unknown) {
  return fieldSetToZod(studioVideoFields, true).safeParse(
    raw === undefined
      ? { repeat: !!loop }
      : raw && typeof raw === "object" && !Array.isArray(raw)
        ? { repeat: !!loop, ...raw }
        : raw
  );
}

export interface MegaTypography {
  font?: string;
  size?: number;
  weight?: number;
  leading?: number;
  tracking?: number;
  align?: "left" | "center" | "right";
  italic?: boolean;
  color?: string;
}
export const MEGA_HOVER_ANIMATIONS = [
  "slide",
  "fade",
  "underline",
  "lift",
  "grow",
  "shrink",
  "tilt-left",
  "tilt-right",
  "skew",
  "tracking",
  "blur-reveal",
  "glow",
  "shadow",
  "underline-sweep",
  "highlight-sweep",
  "border-draw",
  "bracket",
  "arrow",
  "none",
] as const;
export interface StudioMegaMenuConfig {
  hoverColor?: string;
  imageColor?: boolean;
  matchPageAccent?: boolean;
  imageOverlay?: MediaOverlay;
  font?: string;
  color?: string;
  accent?: string;
  categories: {
    label: string;
    stories: { title: string; description?: string; image?: string; alt?: string; url?: string }[];
  }[];
  typeStyles?: { category?: MegaTypography; heading?: MegaTypography; subtitle?: MegaTypography };
  hoverAnimation?: (typeof MEGA_HOVER_ANIMATIONS)[number];
  storyAnimation?: "rise" | "fade" | "slide" | "none";
  animationDuration?: number;
}
const typography: FieldSet = {
  font: field.font({ label: "Font" }),
  size: field.number({ label: "Size", min: 10, max: 100 }),
  weight: field.number({ label: "Weight", min: 100, max: 900 }),
  leading: field.number({ label: "Line height", min: 0.8, max: 2.5 }),
  tracking: field.number({ label: "Letter spacing", min: -3, max: 12 }),
  align: field.select({ label: "Alignment", options: options("left", "center", "right") }),
  italic: field.boolean({ label: "Italic" }),
  color: field.text({ label: "Color" }),
};
export const studioMegaMenuFields: FieldSet = {
  hoverColor: field.text({ label: "Category hover color" }),
  imageColor: field.boolean({ label: "Full-color story images" }),
  matchPageAccent: field.boolean({ label: "Use page accent for story labels and hover" }),
  imageOverlay: field.group({ label: "Story image overlay", fields: mediaOverlayFields }),
  font: field.font({ label: "Font" }),
  color: field.text({ label: "Text color" }),
  accent: field.text({ label: "Active category color" }),
  categories: field.list({
    label: "Categories",
    min: 1,
    max: 20,
    required: true,
    of: {
      label: field.text({ label: "Category label", required: true }),
      stories: field.list({
        label: "Stories",
        max: 100,
        required: true,
        of: {
          title: field.text({ label: "Title", required: true }),
          description: field.textarea({ label: "Description" }),
          image: field.image({ label: "Image" }),
          alt: field.text({ label: "Image description" }),
          url: field.url({ label: "Optional story link" }),
        },
      }),
    },
  }),
  typeStyles: field.group({
    label: "Typography",
    fields: {
      category: field.group({ label: "Categories", fields: typography }),
      heading: field.group({ label: "Headings", fields: typography }),
      subtitle: field.group({ label: "Subtitles", fields: typography }),
    },
  }),
  hoverAnimation: field.select({
    label: "Category hover",
    options: options(...MEGA_HOVER_ANIMATIONS),
  }),
  storyAnimation: field.select({
    label: "Story transition",
    options: options("rise", "fade", "slide", "none"),
  }),
  animationDuration: field.number({ label: "Animation duration", min: 80, max: 800 }),
};
export function normalizeStudioMegaMenu(raw: unknown): {
  value?: StudioMegaMenuConfig;
  issues: string[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { issues: ["Configure the mega menu in section settings."] };
  const config = structuredClone(raw) as StudioMegaMenuConfig;
  for (const style of [config, ...Object.values(config.typeStyles || {})]) {
    if (style && typeof style === "object" && typeof style.font === "string")
      style.font =
        FONT_LIBRARY.find((f) => f.label === style.font || f.value === style.font)?.value ||
        style.font;
  }
  const parsed = fieldSetToZod(studioMegaMenuFields, true).safeParse(config);
  if (!parsed.success)
    return {
      issues: parsed.error.issues.map((i) => `Mega menu ${i.path.join(".")}: ${i.message}`),
    };
  const value = parsed.data as unknown as StudioMegaMenuConfig,
    issues: string[] = [];
  for (const color of [
    value.color,
    value.accent,
    value.hoverColor,
    ...Object.values(value.typeStyles || {}).map((s) => s.color),
  ])
    if (color !== undefined && !studioColor(color))
      issues.push("Choose a supported mega-menu text or accent color.");
  if (value.imageOverlay && !mediaOverlaySchema.safeParse(value.imageOverlay).success)
    issues.push("Check the story image overlay settings.");
  for (const category of value.categories)
    for (const story of category.stories) {
      if (story.url) {
        const url = studioDestination(story.url);
        if (!url)
          issues.push(
            `“${story.title}” needs a valid story destination, or clear its optional link.`
          );
        else story.url = url;
      }
      if (story.image) {
        const image = studioDestination(story.image, true);
        if (!image) issues.push(`“${story.title}” needs a permanent image URL.`);
        else story.image = image;
      }
    }
  return { value, issues };
}
