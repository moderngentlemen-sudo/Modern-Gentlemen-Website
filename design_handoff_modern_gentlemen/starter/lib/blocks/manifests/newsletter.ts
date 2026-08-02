import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Newsletter.tsx`. */
export const newsletter = defineBlock({
  type: "newsletter",
  label: "Newsletter",
  category: "bands",
  description: "Dispatch sign-up band: heading, optional dek, and an inline email field.",
  fields: {
    heading: field.text({ label: "Heading", required: true }),
    eyebrow: field.text({ label: "Eyebrow" }),
    sub: field.textarea({ label: "Dek" }),
    buttonLabel: field.text({ label: "Button label", default: "Subscribe" }),
    placeholder: field.text({ label: "Input placeholder", default: "your@address.com" }),
  },
  insertDefaults: {
    heading: "Join the dispatch",
  },
});
