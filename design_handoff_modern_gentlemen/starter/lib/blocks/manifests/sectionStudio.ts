import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import { SECTION_STUDIO_PRESETS } from "../sectionStudioPresets";

export const sectionStudio = defineBlock({
  type: "sectionStudio",
  label: "Section studio",
  category: "editorial",
  description:
    "Imported Section Library presets 02–68 plus additive platform presets 126–145 across editorial, media, people, data, commerce and utility archetypes.",
  fields: {
    variant: field.select({
      label: "Library preset",
      default: "categoryRail",
      options: SECTION_STUDIO_PRESETS.map(([value, module, label]) => ({
        value,
        label: `${module} · ${label}`,
      })),
    }),
    eyebrow: field.text({ label: "Eyebrow" }),
    title: field.textarea({ label: "Title", required: true }),
    intro: field.textarea({ label: "Introduction" }),
    image: field.image({ label: "Primary image" }),
    imageAlt: field.text({ label: "Primary image alt text" }),
    items: field.list({
      label: "Entries",
      itemLabel: "entry",
      max: 12,
      of: {
        title: field.text({ label: "Title", required: true }),
        text: field.textarea({ label: "Description or quote" }),
        meta: field.text({ label: "Category, date or attribution" }),
        value: field.text({ label: "Number, price or value" }),
        image: field.image({ label: "Image" }),
        alt: field.text({ label: "Image alt text" }),
        href: field.url({ label: "Link" }),
      },
    }),
    cta: field.link({ label: "Section action" }),
    columns: field.select({
      label: "Columns",
      default: "3",
      options: [
        { value: "2", label: "Two" },
        { value: "3", label: "Three" },
        { value: "4", label: "Four" },
      ],
    }),
    tone: field.select({
      label: "Color treatment",
      default: "light",
      options: [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "accent", label: "Accent" },
      ],
    }),
    showNumbers: field.boolean({ label: "Show entry numbers", default: true }),
    imageRatio: field.select({
      label: "Card image ratio",
      default: "landscape",
      options: [
        { value: "square", label: "Square" },
        { value: "portrait", label: "Portrait" },
        { value: "landscape", label: "Landscape" },
        { value: "wide", label: "Widescreen" },
      ],
    }),
  },
  insertDefaults: {
    variant: "categoryRail",
    eyebrow: "The Modern Gentlemen edit",
    title: "A considered point of view",
    intro: "A flexible editorial module drawn from the original section library.",
    image: "/images/hero-cover.jpg",
    imageAlt: "Editorial feature",
    items: [
      {
        title: "The art of considered living",
        text: "Objects, ideas and people worth your attention.",
        meta: "Culture",
        value: "01",
        image: "/images/hero-cover.jpg",
        alt: "Editorial feature",
        href: "/",
      },
      {
        title: "A modern uniform",
        text: "A practical study in proportion, material and restraint.",
        meta: "Style",
        value: "02",
        image: "/images/style-mono.jpg",
        alt: "Monochrome tailoring",
        href: "/",
      },
      {
        title: "Made to endure",
        text: "Mechanical details and the pleasure of keeping good things.",
        meta: "Watches",
        value: "03",
        image: "/images/watch-gear.jpg",
        alt: "Mechanical watch",
        href: "/",
      },
    ],
    cta: { label: "Explore", href: "/" },
  },
});
