import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/NumberedIndex.tsx`. */
export const numberedIndex = defineBlock({
  type: "numberedIndex",
  label: "The Index — numbered list",
  category: "editorial",
  description:
    "Hairline-ruled numbered list. An item without an explicit number falls back to its 1-based position, zero-padded.",
  fields: {
    heading: field.text({ label: "Heading" }),
    items: field.list({
      label: "Entries",
      required: true,
      itemLabel: "entry",
      of: {
        num: field.text({ label: "Number", help: "Defaults to the item's position." }),
        title: field.text({ label: "Title", required: true }),
        meta: field.text({ label: "Meta" }),
        href: field.url({ label: "Link" }),
      },
    }),
  },
  insertDefaults: {
    items: [{ title: "First entry" }],
  },
  bindable: ["items"],
});
