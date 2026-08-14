import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/Columns.tsx` — the first container
 * block, and the only manifest that declares a `slot`.
 *
 * The slot is deliberately unrestricted (`allow` omitted), including of
 * `columns` itself: arbitrary nesting is the decision this slice records, and a
 * whitelist here would be a second place to keep in step with the registry
 * every time a block is added.
 *
 * `max` is 4 because the widest ratio is four columns. More children than
 * columns is legal and wraps onto another row — the cap is about keeping a row
 * legible, not about the grid breaking.
 */
export const columns = defineBlock({
  type: "columns",
  label: "Columns — layout",
  category: "layout",
  description:
    "A row of columns holding other sections. Choose the ratio, the gap and the width at which it stacks to one column.",
  fields: {
    ratio: field.select({
      label: "Columns",
      default: "1-1",
      options: [
        { value: "1-1", label: "Two equal" },
        { value: "2-1", label: "Two — wide then narrow" },
        { value: "1-2", label: "Two — narrow then wide" },
        { value: "1-1-1", label: "Three equal" },
        { value: "1-1-1-1", label: "Four equal" },
      ],
    }),
    stackAt: field.select({
      label: "Stacks below",
      default: "680",
      options: [
        { value: "680", label: "680px — phones only" },
        { value: "820", label: "820px — phones and small tablets" },
        { value: "1024", label: "1024px — everything under desktop" },
      ],
    }),
    gap: field.select({
      label: "Gap",
      default: "md",
      options: [
        { value: "none", label: "None" },
        { value: "sm", label: "Small — 16px" },
        { value: "md", label: "Medium — 32px" },
        { value: "lg", label: "Large — 48px" },
      ],
    }),
    align: field.select({
      label: "Vertical alignment",
      default: "stretch",
      options: [
        { value: "stretch", label: "Stretch" },
        { value: "top", label: "Top" },
        { value: "middle", label: "Middle" },
      ],
    }),
    width: field.select({
      label: "Width",
      default: "contained",
      options: [
        { value: "contained", label: "Contained — 1320px column" },
        { value: "full", label: "Full bleed" },
      ],
    }),
  },
  slot: {
    label: "Columns",
    min: 1,
    max: 4,
  },
});
