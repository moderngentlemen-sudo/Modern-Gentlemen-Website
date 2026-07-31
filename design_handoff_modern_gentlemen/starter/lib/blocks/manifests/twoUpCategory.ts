import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/TwoUpCategory.tsx`. */
export const twoUpCategory = defineBlock({
  type: "twoUpCategory",
  label: "Two-up category",
  category: "editorial",
  description:
    "Two large category cards side by side, each a fixed-height cover over a captioned panel. Renders the first two items only.",
  fields: {
    items: field.list({
      label: "Cards",
      required: true,
      itemLabel: "card",
      max: 2,
      of: {
        kicker: field.text({ label: "Kicker" }),
        title: field.text({ label: "Title", required: true }),
        body: field.textarea({ label: "Body" }),
        href: field.url({ label: "Link" }),
        image: field.image({ label: "Image" }),
      },
    }),
  },
  insertDefaults: {
    items: [{ title: "First card" }, { title: "Second card" }],
  },
  bindable: ["items"],
});
