import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Testimonials.tsx`. */
export const testimonials = defineBlock({
  type: "testimonials",
  label: "Member Voices",
  category: "people",
  description:
    "Three-up quote cards with attribution. A single quote also covers the contributor-spotlight treatment.",
  fields: {
    heading: field.text({ label: "Heading" }),
    quotes: field.list({
      label: "Quotes",
      required: true,
      itemLabel: "quote",
      of: {
        text: field.textarea({ label: "Quote", required: true }),
        name: field.text({ label: "Name", required: true }),
        detail: field.text({ label: "Detail", help: "Role, location or membership tier." }),
      },
    }),
  },
  insertDefaults: {
    quotes: [{ text: "What they said.", name: "A. Member" }],
  },
});
