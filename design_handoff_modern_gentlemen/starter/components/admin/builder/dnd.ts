/**
 * The reordering rule, extracted from the canvas so it can actually be tested.
 *
 * dnd-kit measures the DOM, and jsdom has no layout engine — `ResizeObserver` is
 * stubbed in the unit setup but inert, so a simulated drag proves nothing. The
 * canvas therefore reduces a drag to "this key moved onto that key" and calls
 * a pure function with it. The moves themselves live in `tree.ts`, which
 * replaced this file's root-array `reorderByKey` when containers arrived: a
 * `findIndex` over the root cannot express "into that container".
 *
 * Drag-from-library follows the same philosophy: the identifiers below encode
 * everything a drop needs, `parseDragId` and `dropIndexFor` decide what it
 * means, and the React layer is left as a dispatcher. Both library and
 * existing-block drags share the explicit gap identifiers; the latter now use
 * them to position a move inside a non-empty container. A real drag is proved
 * in `tests/e2e/builder.spec.ts`, which is the only place it can be.
 */

/**
 * What a dnd-kit identifier refers to.
 *
 * Block keys are minted by `node.ts#newKey` as `k_…`, so neither prefix below
 * can collide with one, and anything unprefixed is a block key by elimination.
 */
export type DragId =
  | { kind: "library"; type: string }
  | { kind: "gap"; parentKey: string | null; index: number }
  | { kind: "block"; key: string };

/** A place a block can land: a list, and a position in it. */
export interface DropLocation {
  /** The container to drop into, or `null` for the root list. */
  parentKey: string | null;
  index: number;
}

const LIBRARY_PREFIX = "library:";
const GAP_PREFIX = "gap:";

/** The draggable id for a library entry of `type`. */
export function libraryDragId(type: string): string {
  return `${LIBRARY_PREFIX}${type}`;
}

/**
 * The droppable id for the insertion point before `index` in `parentKey`'s list.
 *
 * The parent is encoded in the id because that is all dnd-kit hands back on a
 * drop — an index alone was enough while every list was the root one, and stops
 * being enough the moment a container has a list of its own.
 */
export function gapDropId(index: number, parentKey: string | null = null): string {
  return parentKey === null ? `${GAP_PREFIX}${index}` : `${GAP_PREFIX}${parentKey}:${index}`;
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
    const body = raw.slice(GAP_PREFIX.length);
    const split = body.lastIndexOf(":");

    // Block keys are `k_…` and carry no colon, so the last one separates the
    // parent from the index without ambiguity.
    const parentKey = split === -1 ? null : body.slice(0, split);
    const index = Number(split === -1 ? body : body.slice(split + 1));

    if (Number.isInteger(index)) return { kind: "gap", parentKey, index };
  }

  return { kind: "block", key: raw };
}

/**
 * Where a block dropped on `overId` lands, or `null` when that is not somewhere
 * a block can go.
 *
 * Gaps are explicit droppables rather than a midpoint inferred from whichever
 * block is hovered: the position is then unambiguous, the indicator has a DOM
 * home, and both are assertable without a layout engine.
 *
 * No clamping happens here, and none is needed — `tree.ts#insertAt` clamps
 * against the list it is actually inserting into, which is the only place that
 * knows how long a container's list is.
 */
export function dropLocationFor(overId: string | number | null | undefined): DropLocation | null {
  if (overId === null || overId === undefined) return null;

  const over = parseDragId(overId);
  if (over.kind !== "gap") return null;

  return { parentKey: over.parentKey, index: over.index };
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

