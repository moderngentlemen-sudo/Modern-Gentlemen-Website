import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/StoryBand.tsx`. */
export const storyBand = defineBlock({
  type: "storyBand",
  label: "Story band",
  category: "bands",
  description:
    "Inset dark band with a centred statement, optional supporting paragraph and attribution, over an optional darkened background image.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow" }),
    quote: field.textarea({
      label: "Statement",
      required: true,
      help: "The centred headline or quote.",
    }),
    body: field.textarea({ label: "Supporting paragraph" }),
    attribution: field.text({ label: "Attribution" }),
    backgroundImage: field.image({ label: "Background image" }),
    cta: field.link({
      label: "Call to action",
      extra: {
        style: field.select({
          label: "Button style",
          options: [
            { value: "solid", label: "Solid" },
            { value: "outline", label: "Outline" },
          ],
        }),
      },
    }),
  },
  insertDefaults: {
    quote: "A statement worth setting in the middle of the page.",
  },
});
