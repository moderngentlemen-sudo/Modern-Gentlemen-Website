import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/LatestGrid.tsx`. */
export const latestGrid = defineBlock({
  type: "latestGrid",
  label: "The Latest — grid",
  category: "editorial",
  description:
    "Editorial magazine grid. The `sixUp` variant is the homepage canon: dark feature tile, image tiles with frosted captions, and a red membership tile.",
  fields: {
    heading: field.text({ label: "Heading", default: "The Latest" }),
    eyebrow: field.text({ label: "Eyebrow" }),
    viewAllHref: field.url({ label: "View-all link" }),
    viewAllLabel: field.text({ label: "View-all label", default: "View all →" }),
    variant: field.select({
      label: "Layout",
      default: "threeCol",
      options: [
        { value: "threeCol", label: "Three column" },
        { value: "featureLeft", label: "Feature left" },
        { value: "mosaic", label: "Mosaic" },
        { value: "sixUp", label: "Six-up (homepage)" },
      ],
    }),
    items: field.list({
      label: "Tiles",
      required: true,
      itemLabel: "tile",
      of: {
        kind: field.select({
          label: "Tile kind",
          options: [
            { value: "feature", label: "Feature" },
            { value: "image", label: "Image" },
            { value: "membership", label: "Membership" },
          ],
        }),
        kicker: field.text({ label: "Kicker" }),
        title: field.text({ label: "Title", required: true }),
        body: field.textarea({ label: "Body" }),
        meta: field.text({ label: "Meta", help: 'e.g. "6 min"' }),
        href: field.url({ label: "Link" }),
        image: field.image({ label: "Image" }),
      },
    }),
  },
  insertDefaults: {
    items: [{ kind: "image", title: "Story title" }],
  },
  bindable: ["items"],
});
