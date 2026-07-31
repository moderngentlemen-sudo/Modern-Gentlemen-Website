/**
 * The reordering rule, extracted from the canvas so it can actually be tested.
 *
 * dnd-kit measures the DOM, and jsdom has no layout engine — `ResizeObserver` is
 * stubbed in the unit setup but inert, so a simulated drag proves nothing. The
 * canvas therefore reduces a drag to "this key moved onto that key" and calls
 * this, which is pure.
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

/** `from` moves to index `to`, clamped. Used by the list repeater and keyboard moves. */
export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;

  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
