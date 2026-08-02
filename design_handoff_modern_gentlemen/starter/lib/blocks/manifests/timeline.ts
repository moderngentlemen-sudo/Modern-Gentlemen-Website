import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Timeline.tsx`. */
export const timeline = defineBlock({
  type: "timeline",
  label: "Timeline — a brief history",
  category: "editorial",
  description:
    "Ruled vertical timeline with an accent node per entry. Also covers date-led calendar listings.",
  fields: {
    heading: field.text({ label: "Heading" }),
    entries: field.list({
      label: "Entries",
      required: true,
      itemLabel: "entry",
      of: {
        year: field.text({ label: "Year", required: true }),
        title: field.text({ label: "Title", required: true }),
        body: field.textarea({ label: "Body" }),
      },
    }),
  },
  insertDefaults: {
    entries: [{ year: "2026", title: "The first entry" }],
  },
});
