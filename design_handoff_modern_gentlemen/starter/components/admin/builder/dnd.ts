/**
 * The reordering rule, extracted from the canvas so it can actually be tested.
 *
 * dnd-kit measures the DOM, and jsdom has no layout engine — `ResizeObserver` is
 * stubbed in the unit setup but inert, so a simulated drag proves nothing. The
 * canvas therefore reduces a drag to "this key moved onto that key" and calls
 * this, which is pure.
 *
 * Drag-from-library follows the same philosophy: the identifiers below encode
 * everything a drop needs, `parseDragId` and `dropIndexFor` decide what it
 * means, and the React layer is left as a dispatcher. A real drag is proved in
 * `tests/e2e/builder.spec.ts`, which is the only place it can be.
 */

import type { BlockTree } from "@/lib/blocks/types";

/** `activeKey` moves to `overKey`'s position. Unknown keys leave the tree alone. */
export function reorderByKey(tree: BlockTree, activeKey: string, overKey: string): BlockTree {
  if (activeKey === overKey) return tree;

  const from = tree.findIndex((node) => node._key === activeKey);
  const to = tree.findIndex((node) => node._key === overKey);
  if (from === -1 || to === -1) return tree;

  const next = [...tree];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * What a dnd-kit identifier refers to.
 *
 * Block keys are minted by `node.ts#newKey` as `k_…`, so neither prefix below
 * can collide with one, and anything unprefixed is a block key by elimination.
 */
export type DragId =
  | { kind: "library"; type: string }
  | { kind: "gap"; index: number }
  | { kind: "block"; key: string };

const LIBRARY_PREFIX = "library:";
const GAP_PREFIX = "gap:";

/** The draggable id for a library entry of `type`. */
export function libraryDragId(type: string): string {
  return `${LIBRARY_PREFIX}${type}`;
}

/** The droppable id for the insertion point before block `index`. */
export function gapDropId(index: number): string {
  return `${GAP_PREFIX}${index}`;
}

/** Every insertion point in a tree of `length` blocks: before each, and after the last. */
export function gapIndexes(length: number): number[] {
  return Array.from({ length: Math.max(0, length) + 1 }, (_, index) => index);
}

export function parseDragId(id: string | number): DragId {
  const raw = String(id);

  if (raw.startsWith(LIBRARY_PREFIX)) {
    return { kind: "library", type: raw.slice(LIBRARY_PREFIX.length) };
  }

  if (raw.startsWith(GAP_PREFIX)) {
    const index = Number(raw.slice(GAP_PREFIX.length));
    if (Number.isInteger(index)) return { kind: "gap", index };
  }

  return { kind: "block", key: raw };
}

/**
 * Where a library item dropped on `overId` lands, or `null` when that is not
 * somewhere a new block can go.
 *
 * Gaps are explicit droppables rather than a midpoint inferred from whichever
 * block is hovered: the index is then unambiguous, the indicator has a DOM home,
 * and both are assertable without a layout engine.
 */
export function dropIndexFor(
  overId: string | number | null | undefined,
  treeLength: number
): number | null {
  if (overId === null || overId === undefined) return null;

  const over = parseDragId(overId);
  if (over.kind !== "gap") return null;

  return Math.max(0, Math.min(Math.max(0, treeLength), over.index));
}

/** `from` moves to index `to`, clamped. Used by the list repeater and keyboard moves. */
export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;

  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
