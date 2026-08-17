import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/Column.tsx` — one cell of a `columns`
 * row, and the second container block.
 *
 * **`min` is deliberately absent, unlike the row's.** `columns` declares
 * `min: 1` so an empty row cannot publish; a column is the opposite case. An
 * empty column is a real layout choice — it is how a row offsets its content to
 * the right, and how a three-column band leaves its middle cell open — so
 * refusing to publish one would forbid a thing the grid exists to express.
 *
 * The slot is unrestricted, which is what keeps arbitrary nesting: a column may
 * hold another `columns` row. The restriction runs the other way — the row
 * accepts only columns — so the two together give exactly one shape,
 * row → column → anything, with no way to build a row of loose blocks.
 *
 * ⚠️ **Not offered in the insert menu.** A column outside a row is a `flex`
 * wrapper around nothing in particular: it renders, it just means nothing, and
 * `columns` seeds its own via `insertChildren`. `hidden` is what keeps it out of
 * the library while leaving it a fully registered block that the canvas, the
 * validator and the renderer all know.
 */
export const column = defineBlock({
  type: "column",
  label: "Column",
  category: "layout",
  description: "One cell of a columns row. Holds any sections, stacked.",
  hidden: true,
  fields: {
    justify: field.select({
      label: "Content sits",
      default: "top",
      options: [
        { value: "top", label: "Top" },
        { value: "middle", label: "Middle" },
        { value: "bottom", label: "Bottom" },
      ],
    }),
  },
  slot: {
    label: "Sections",
  },
});
