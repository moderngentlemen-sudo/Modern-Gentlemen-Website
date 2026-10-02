import {
  EDITORIAL_COLLECTION,
  collectionType,
  type EditorialCollectionType,
} from "@/lib/domain/editorialCollection";
import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import type { BlockManifest } from "../types";

const entries = field.list({
  label: "Stories / chapters",
  itemLabel: "chapter",
  max: 24,
  of: {
    title: field.text({ label: "Story / chapter heading", required: true }),
    text: field.richText({
      label: "Copy",
      help: "Paragraphs, links, lists and emphasis are supported.",
    }),
    meta: field.text({ label: "Category / time / date" }),
    image: field.image({ label: "Image" }),
    alt: field.text({ label: "Image description" }),
    caption: field.text({ label: "Caption / credit" }),
    href: field.url({ label: "Story / reference destination" }),
  },
});

export const editorialCollectionManifests = Object.fromEntries(
  EDITORIAL_COLLECTION.map((c) => [
    collectionType(c.id),
    defineBlock({
      type: collectionType(c.id),
      label: `MG ${c.id} · ${c.name}${c.kind === "article" ? " · Article body" : ""}`,
      category:
        c.kind === "article"
          ? "editorial"
          : c.hero === "full" || c.id === "01"
            ? "hero"
            : c.group === "People"
              ? "people"
              : "editorial",
      description: `MG 90 collection. ${c.group}. ${c.description}`,
      ...(c.kind === "article" ? { onlyIn: ["article", "template"] } : {}),
      fields: {
        ...(c.kind === "section"
          ? {
              title: field.textarea({ label: "Heading", required: true }),
              eyebrow: field.text({ label: "Eyebrow" }),
              image: field.image({ label: "Feature image" }),
              imageAlt: field.text({ label: "Feature image description" }),
              caption: field.text({ label: "Feature caption / credit" }),
            }
          : {}),
        intro: field.richText({
          label: c.kind === "article" ? "Opening paragraphs" : "Introduction",
        }),
        items: entries,
        quote: field.textarea({ label: "Pull quote" }),
        attribution: field.text({ label: "Quote attribution" }),
        notes: field.richText({ label: "Editor's notes / closing paragraphs" }),
        facts: field.list({
          label: "Facts / specifications",
          itemLabel: "fact",
          max: 20,
          of: {
            label: field.text({ label: "Label", required: true }),
            value: field.text({ label: "Value", required: true }),
            alternative: field.text({ label: "Second object value (comparison)" }),
          },
        }),
        cta: field.link({ label: "Primary action", help: "Add a destination to show an action." }),
        related: field.list({
          label: "Related stories",
          itemLabel: "story",
          max: 6,
          of: {
            title: field.text({ label: "Title", required: true }),
            href: field.url({ label: "Destination", required: true }),
            image: field.image({ label: "Image" }),
            alt: field.text({ label: "Image description" }),
          },
        }),
        imagePosition: field.select({
          label: "Image focal point",
          default: "center",
          options: ["center", "top", "bottom"].map((value) => ({ value, label: value })),
        }),
        ...(c.kind === "section"
          ? {
              tone: field.select({
                label: "Color treatment",
                default: c.tone,
                options: [
                  { value: "theme", label: "Follow site theme" },
                  { value: "dark", label: "Always dark" },
                ],
              }),
            }
          : {}),
        ...(["05", "31", "47", "57"].includes(c.id)
          ? {
              mediaUrl: field.url({
                label: "Video / audio file URL",
                help: "Use a hosted MP4/WebM or MP3/M4A file. Playback starts on demand.",
              }),
            }
          : {}),
        ...(["05", "57"].includes(c.id)
          ? {
              captionsUrl: field.url({
                label: "Video captions URL",
                help: "Add a hosted WebVTT file for spoken video captions.",
              }),
            }
          : {}),
        ...(["19", "84"].includes(c.id)
          ? {
              disclosure: field.text({
                label: "Partnership disclosure",
                required: true,
                default: "Partner story",
              }),
            }
          : {}),
        ...(c.kind === "article"
          ? {
              showIndex: field.boolean({
                label: "Show chapter navigation",
                default: ["guide", "reference", "itinerary", "narrative"].includes(c.layout),
              }),
            }
          : {}),
      },
      insertDefaults: {
        ...(c.kind === "section" ? { title: c.name, eyebrow: c.group } : {}),
        intro:
          c.kind === "article"
            ? "Write your opening paragraphs here."
            : "Add your introduction here.",
        items: c.chapters.map((title) => ({ title, text: "Write your editorial copy here." })),
      },
      bindable: c.kind === "section" ? ["items"] : [],
    }),
  ])
) as Record<EditorialCollectionType, BlockManifest>;
