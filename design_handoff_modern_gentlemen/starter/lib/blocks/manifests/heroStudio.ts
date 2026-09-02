import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import { HERO_STUDIO_PRESETS } from "../heroStudioPresets";

export const heroStudio = defineBlock({
  type: "heroStudio",
  label: "Hero studio",
  category: "hero",
  description:
    "The complete Section Library hero catalogue: 01, every standard hero from 69–115, and Vogue 6A–6J from 116–125.",
  fields: {
    variant: field.select({
      label: "Library preset",
      default: "editorialSplit",
      options: HERO_STUDIO_PRESETS.map((preset) => ({
        value: preset.value,
        label: `${preset.module} · ${preset.label}`,
      })),
    }),
    eyebrow: field.text({ label: "Eyebrow" }),
    headline: field.textarea({ label: "Headline", required: true }),
    accent: field.text({ label: "Accent phrase" }),
    body: field.textarea({ label: "Supporting copy" }),
    image: field.image({ label: "Primary image" }),
    imageAlt: field.text({ label: "Primary image alt text" }),
    images: field.list({
      label: "Image collection",
      itemLabel: "image",
      max: 6,
      of: {
        image: field.image({ label: "Image", required: true }),
        alt: field.text({ label: "Alt text" }),
      },
    }),
    highlights: field.list({
      label: "Headlines, rankings or ticker items",
      itemLabel: "item",
      max: 8,
      of: {
        value: field.text({ label: "Number or value" }),
        label: field.text({ label: "Label", required: true }),
        href: field.url({ label: "Link" }),
      },
    }),
    primaryCta: field.link({ label: "Primary action" }),
    secondaryCta: field.link({ label: "Secondary action" }),
    imagePosition: field.select({
      label: "Split image position",
      default: "right",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
    }),
    align: field.select({
      label: "Text alignment",
      default: "left",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
    }),
    height: field.select({
      label: "Height",
      default: "tall",
      options: [
        { value: "compact", label: "Compact" },
        { value: "tall", label: "Tall" },
        { value: "screen", label: "Full screen" },
      ],
    }),
    titleSize: field.select({
      label: "Title size",
      default: "standard",
      options: [
        { value: "compact", label: "Compact" },
        { value: "standard", label: "Standard" },
        { value: "display", label: "Display" },
      ],
    }),
    overlay: field.select({
      label: "Cover overlay",
      default: "medium",
      options: [
        { value: "light", label: "Light" },
        { value: "medium", label: "Medium" },
        { value: "strong", label: "Strong" },
      ],
    }),
    tone: field.select({
      label: "Color treatment",
      default: "dark",
      options: [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "accent", label: "Accent" },
      ],
    }),
  },
  insertDefaults: {
    variant: "editorialSplit",
    eyebrow: "The cover story",
    headline: "Speed, Considered",
    body: "Why the modern gentleman drives slow cars fast — an essay on patience, stewardship, and the machines worth keeping.",
    image: "/images/hero-cover.jpg",
    imageAlt: "A considered motoring scene",
    primaryCta: { label: "Read the story", href: "/" },
    images: [
      { image: "/images/hero-cover.jpg", alt: "Editorial portrait" },
      { image: "/images/style-mono.jpg", alt: "Monochrome tailoring" },
      { image: "/images/watch-gear.jpg", alt: "Mechanical watch" },
    ],
    highlights: [
      { value: "01", label: "The lead story", href: "/" },
      { value: "02", label: "Editor's selection", href: "/" },
      { value: "03", label: "The essential detail", href: "/" },
    ],
  },
});
