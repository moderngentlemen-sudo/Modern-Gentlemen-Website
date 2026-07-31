import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/StatsBand.tsx`. */
export const statsBand = defineBlock({
  type: "statsBand",
  label: "By the Numbers — stats",
  category: "bands",
  description:
    "Figures with mono captions. `band` is a full-bleed dark band with white numerals; `cards` is a hairline card grid with red numerals.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow", help: "Shown by the band variant only." }),
    stats: field.list({
      label: "Figures",
      required: true,
      itemLabel: "figure",
      of: {
        value: field.text({ label: "Value", required: true }),
        label: field.text({ label: "Caption", required: true }),
      },
    }),
    variant: field.select({
      label: "Layout",
      default: "band",
      options: [
        { value: "band", label: "Dark band" },
        { value: "cards", label: "Hairline cards" },
      ],
    }),
  },
  insertDefaults: {
    stats: [{ value: "042", label: "Issues published" }],
  },
});
