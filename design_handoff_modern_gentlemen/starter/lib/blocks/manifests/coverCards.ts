import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/CoverCards.tsx`. */
export const coverCards = defineBlock({
  type: "coverCards",
  label: "What we cover — cards",
  category: "editorial",
  description: "Three linked cards that lift on hover, under a mono rail label.",
  fields: {
    label: field.text({ label: "Rail label", required: true }),
    cards: field.list({
      label: "Cards",
      required: true,
      itemLabel: "card",
      of: {
        title: field.text({ label: "Title", required: true }),
        body: field.textarea({ label: "Body", required: true }),
        href: field.url({ label: "Link", required: true }),
      },
    }),
  },
  insertDefaults: {
    label: "WHAT WE COVER",
    cards: [{ title: "Style", body: "What it covers.", href: "/style" }],
  },
});
