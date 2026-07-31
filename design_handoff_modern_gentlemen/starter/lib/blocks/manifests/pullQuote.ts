import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/PullQuote.tsx`. */
export const pullQuote = defineBlock({
  type: "pullQuote",
  label: "Pull quote",
  category: "editorial",
  description:
    "Centred serif italic quote in a narrow column, with accent-red quotation marks and a mono attribution.",
  fields: {
    quote: field.textarea({ label: "Quote", required: true }),
    attribution: field.text({ label: "Attribution", required: true }),
    size: field.select({
      label: "Size",
      default: "lg",
      options: [
        { value: "lg", label: "Large" },
        { value: "md", label: "Medium" },
      ],
    }),
  },
  insertDefaults: {
    quote: "Something worth quoting.",
    attribution: "A. BELLAMY",
  },
});
