import { defineBlock } from "../defineBlock";
import { field } from "../fields";

export const stack = defineBlock({
  type: "stack",
  label: "Stack",
  category: "layout",
  description:
    "A nestable vertical or horizontal flow with responsive stacking, alignment and gap controls.",
  fields: {
    direction: field.select({
      label: "Direction",
      default: "vertical",
      options: [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
      ],
    }),
    stackAt: field.select({
      label: "Horizontal stacks below",
      default: "820",
      help: "Used only for a horizontal stack.",
      options: [
        { value: "never", label: "Never" },
        { value: "680", label: "680px — phones" },
        { value: "820", label: "820px — small tablets" },
        { value: "1024", label: "1024px — under desktop" },
      ],
    }),
    gap: field.select({
      label: "Gap",
      default: "medium",
      options: [
        { value: "none", label: "None" },
        { value: "small", label: "Small — 16px" },
        { value: "medium", label: "Medium — 32px" },
        { value: "large", label: "Large — 48px" },
        { value: "xlarge", label: "Extra large — 80px" },
      ],
    }),
    align: field.select({
      label: "Cross-axis alignment",
      default: "stretch",
      options: [
        { value: "start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "end", label: "End" },
        { value: "stretch", label: "Stretch" },
      ],
    }),
    justify: field.select({
      label: "Main-axis distribution",
      default: "start",
      options: [
        { value: "start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "end", label: "End" },
        { value: "between", label: "Space between" },
      ],
    }),
    wrap: field.boolean({
      label: "Allow wrapping",
      default: false,
      help: "Lets horizontal children continue on another line when space runs out.",
    }),
  },
  slot: {
    label: "Items",
  },
});
