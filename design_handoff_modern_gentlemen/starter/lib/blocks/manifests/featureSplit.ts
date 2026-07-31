import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/FeatureSplit.tsx`. */
export const featureSplit = defineBlock({
  type: "featureSplit",
  label: "Feature — split",
  category: "editorial",
  description:
    "Image-and-copy feature. `fullBleed` is the homepage Style Feature: an edge-to-edge band with the caption anchored to the content gutter.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow" }),
    headline: field.textarea({ label: "Headline", required: true }),
    body: field.textarea({ label: "Body" }),
    image: field.image({ label: "Image" }),
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
    variant: field.select({
      label: "Layout",
      default: "imageRight",
      options: [
        { value: "imageRight", label: "Image right" },
        { value: "imageLeft", label: "Image left" },
        { value: "overlap", label: "Overlap" },
        { value: "fullBleed", label: "Full bleed" },
      ],
    }),
  },
  insertDefaults: {
    headline: "Headline",
  },
});
