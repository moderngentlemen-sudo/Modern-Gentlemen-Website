import type { ReactNode } from "react";

import { clsx } from "../ui/clsx";

/**
 * One cell of a `columns` row, and a container in its own right.
 *
 * ⚠️ **This block exists because "a column" was not a thing.** `columns` used to
 * declare a single slot and hold a flat list of blocks, so which column a block
 * appeared in was decided by its *index* — the grid flowed child 0 into cell 1,
 * child 1 into cell 2, and so on. Three consequences followed, all of them
 * reported from the builder rather than found in a test:
 *
 *   * **there was no per-column drop target.** A drop could only say "at index
 *     N of the row", never "into this column", so dragging a section into an
 *     empty-looking column did nothing at all — the space was not a droppable;
 *   * **the canvas's insertion strips became grid items.** They are rendered as
 *     siblings of the children, so a two-column row holding two blocks laid out
 *     as five cells mid-drag and visibly reshuffled while you dragged;
 *   * **two blocks could not be stacked in one column**, and a row could not
 *     have an empty first cell and a filled second.
 *
 * A column with its own children fixes all three by construction: the drop
 * target is the column, its insertion points live inside it, and stacking is
 * just a list with more than one entry.
 *
 * `min-w-0` is load-bearing rather than decoration. A grid item's default
 * `min-width: auto` refuses to shrink below its content, so one long unbroken
 * word inside a column pushes the whole row wider than its container instead of
 * wrapping.
 */

export type ColumnJustify = "top" | "middle" | "bottom";

const JUSTIFY: Record<ColumnJustify, string> = {
  top: "justify-start",
  middle: "justify-center",
  bottom: "justify-end",
};

interface Props {
  /** Where this column's content sits when the row is taller than it is. */
  justify?: ColumnJustify;
  children?: ReactNode;
}

export function Column({ justify = "top", children }: Props) {
  return <div className={clsx("flex min-w-0 flex-col", JUSTIFY[justify])}>{children}</div>;
}
