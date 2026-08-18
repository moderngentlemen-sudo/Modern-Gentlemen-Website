import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/Columns.tsx` — the first container
 * block, and the only manifest that declares a `slot`.
 *
 * ⚠️ **The slot accepts `column` and nothing else, and that is a change from
 * how this block started.** It used to be unrestricted and hold a flat list of
 * sections, with the grid deciding which cell each one landed in by its index.
 * That made "a column" a position rather than a thing, and three defects
 * followed — no per-column drop target, insertion strips that became grid
 * cells, and no way to stack two blocks in one cell. `Column.tsx` records them
 * in full.
 *
 * Nesting is unaffected: `column`'s own slot is unrestricted, so a column may
 * hold another row. The pair gives exactly one shape — row → column → anything
 * — with no way to build a row of loose sections.
 *
 * **This is the first manifest to use `allow`**, which `validate.ts` has
 * enforced since Phase 2 with no consumer among the shipped blocks.
 *
 * `max` is 4 because the widest ratio is four columns. More columns than the
 * ratio names is legal and wraps onto another row — the cap is about keeping a
 * row legible, not about the grid breaking.
 *
 * `insertChildren` seeds two, matching the `1-1` default: a row that arrives
 * with no columns has nowhere to drop anything, which is the state this whole
 * change exists to remove.
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
  insertChildren: ["column", "column"],
  slot: {
    label: "Columns",
    allow: ["column"],
    // The children sit side by side, so the canvas must not put insertion
    // strips between them: they would take grid cells. See `BlockSlot`.
    direction: "horizontal",
    min: 1,
    max: 4,
  },
});
