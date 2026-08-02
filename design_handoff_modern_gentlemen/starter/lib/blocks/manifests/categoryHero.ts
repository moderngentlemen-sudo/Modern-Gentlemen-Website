import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/CategoryHero.tsx`. */
export const categoryHero = defineBlock({
  type: "categoryHero",
  label: "Category — hero band",
  category: "hero",
  description:
    "Full-bleed category masthead: background image under a downward scrim, oversized title, serif blurb and subcategory chips.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow", required: true }),
    title: field.text({ label: "Title", required: true }),
    blurb: field.textarea({ label: "Blurb" }),
    image: field.image({ label: "Background image", required: true }),
    chips: field.list({
      label: "Subcategory chips",
      itemLabel: "chip",
      of: field.text({ label: "Chip", required: true }),
    }),
  },
  insertDefaults: {
    eyebrow: "Section",
    title: "Category",
    image: "/images/style-mono.jpg",
  },
});
