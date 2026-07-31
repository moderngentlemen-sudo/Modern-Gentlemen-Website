import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Manifesto.tsx`. */
export const manifesto = defineBlock({
  type: "manifesto",
  label: "Manifesto — two-column",
  category: "editorial",
  description:
    "Mono rail label beside a wide column of light-weight paragraphs. The About page's statement of intent.",
  fields: {
    label: field.text({ label: "Rail label", required: true }),
    paragraphs: field.list({
      label: "Paragraphs",
      required: true,
      itemLabel: "paragraph",
      of: field.textarea({ label: "Paragraph", required: true }),
    }),
  },
  insertDefaults: {
    label: "OUR POSITION",
    paragraphs: ["The first paragraph."],
  },
});
