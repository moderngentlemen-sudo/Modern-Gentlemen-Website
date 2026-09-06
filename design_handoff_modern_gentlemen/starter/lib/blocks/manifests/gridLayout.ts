import { defineBlock } from "../defineBlock";
import { field } from "../fields";
export const gridLayout = defineBlock({
  type: "gridLayout",
  label: "Grid canvas",
  category: "layout",
  description:
    "A 12-column canvas with movable, resizable elements and independent desktop, tablet and mobile placement.",
  fields: {
    gap: field.number({ label: "Desktop gap (px)", default: 24, min: 0, max: 80, integer: true }),
    mobileGap: field.number({
      label: "Mobile gap (px)",
      default: 16,
      min: 0,
      max: 80,
      integer: true,
    }),
    rowHeight: field.number({
      label: "Minimum row height (px)",
      default: 48,
      min: 16,
      max: 200,
      integer: true,
      help: "Rows grow to fit content. Resize handles change the number of rows an element spans.",
    }),
  },
  slot: { label: "Grid elements", direction: "horizontal", max: 100 },
  insertChildren: ["nativeHeading", "nativeText"],
});
