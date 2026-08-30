import { defineBlock } from "../defineBlock";
import { field } from "../fields";

export const layoutContainer = defineBlock({
  type: "layoutContainer",
  label: "Container",
  category: "layout",
  description:
    "A nestable width and background boundary. Place sections or other layout elements inside it.",
  fields: {
    width: field.select({
      label: "Content width",
      default: "contained",
      options: [
        { value: "full", label: "Full bleed" },
        { value: "contained", label: "Site content width" },
        { value: "narrow", label: "Reading width — 760px" },
      ],
    }),
    background: field.select({
      label: "Background",
      default: "transparent",
      options: [
        { value: "transparent", label: "Transparent" },
        { value: "surface", label: "Surface" },
        { value: "dark", label: "Dark" },
        { value: "accent", label: "Accent" },
      ],
    }),
    paddingY: field.select({
      label: "Vertical padding",
      default: "medium",
      options: [
        { value: "none", label: "None" },
        { value: "small", label: "Small — 24px" },
        { value: "medium", label: "Medium — 48px" },
        { value: "large", label: "Large — 80px" },
        { value: "xlarge", label: "Extra large — 120px" },
      ],
    }),
  },
  slot: {
    label: "Content",
  },
});
