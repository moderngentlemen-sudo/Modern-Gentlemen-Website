import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Masthead.tsx`. */
export const masthead = defineBlock({
  type: "masthead",
  label: "The Masthead — team",
  category: "people",
  description:
    "Hairline grid of team members, each with an accent-red initial disc, name and role.",
  fields: {
    label: field.text({ label: "Rail label", required: true }),
    people: field.list({
      label: "People",
      required: true,
      itemLabel: "person",
      of: {
        initial: field.text({ label: "Initial", required: true }),
        name: field.text({ label: "Name", required: true }),
        role: field.text({ label: "Role", required: true }),
      },
    }),
  },
  insertDefaults: {
    label: "THE MASTHEAD",
    people: [{ initial: "A", name: "A. Bellamy", role: "Editor" }],
  },
});
