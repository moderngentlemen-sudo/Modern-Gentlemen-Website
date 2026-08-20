/**
 * Path-aware tree surgery, pure.
 *
 * `dnd.ts` reduces a drag to two keys; this reduces a *nested* tree to
 * structural moves over those keys. It exists because every mutation in
 * `store.ts` used to be a `find`/`splice` on the root array, which cannot
 * express "into that container" at all.
 *
 * **Everything here is non-mutating and returns the original reference when
 * nothing changed.** Both properties are load-bearing rather than stylistic:
 * `store.ts#commit` treats an unchanged tree as a no-op and skips the history
 * entry, and undo holds whole previous trees cheaply *because* the unchanged
 * branches are shared rather than copied. A function here that mutated in place
 * would corrupt the undo stack silently — every entry would point at the same
 * mutated arrays.
 */

import { manifestFor } from "@/lib/blocks/manifests";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

/** Where a block sits: which container holds it (`null` = the root), and at what index. */
export interface Location {
  parentKey: string | null;
  index: number;
}

/** Where `key` lives, or `null` if it is not in the tree. */
export function locate(
  tree: BlockTree,
  key: string,
  parentKey: string | null = null
): Location | null {
  for (let index = 0; index < tree.length; index++) {
    const node = tree[index];
    if (node._key === key) return { parentKey, index };

    if (node.children?.length) {
      const found = locate(node.children, key, node._key);
      if (found) return found;
    }
  }
  return null;
}

function find(tree: BlockTree, key: string): BlockNode | null {
  for (const node of tree) {
    if (node._key === key) return node;
    if (node.children?.length) {
      const found = find(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The member of `parentKey`'s list that contains `key` — `key` itself when it is
 * already a direct child, or the ancestor that holds it.
 *
 * What it is for: dropping one **column** onto another. `closestCenter` resolves
 * to whichever droppable centre is nearest, and a column's centre sits close to
 * the centres of the blocks inside it, so a column drag routinely lands on a
 * *nested* block. Passing that key straight to `moveByKey` puts the dragged
 * column inside its neighbour — legal, since a column's slot is unrestricted,
 * and never what anyone meant.
 *
 * Lifting the target to the dragged block's own list turns that into the
 * reorder it looked like. `null` when `key` is outside the list entirely, which
 * is the genuinely-different drop the caller should treat as a move.
 */
export function siblingIn(tree: BlockTree, parentKey: string | null, key: string): string | null {
  const list = parentKey === null ? tree : (find(tree, parentKey)?.children ?? []);
  return list.find((node) => subtreeContains(node, key))?._key ?? null;
}

/** True when `key` is `node` itself or anywhere beneath it. */
export function subtreeContains(node: BlockNode, key: string): boolean {
  if (node._key === key) return true;
  return (node.children ?? []).some((child) => subtreeContains(child, key));
}

/**
 * Rebuilds the list `parentKey` owns, sharing every branch the edit did not
 * touch. Returns the original tree when `edit` hands back the same array.
 */
function withList(
  tree: BlockTree,
  parentKey: string | null,
  edit: (list: BlockTree) => BlockTree
): BlockTree {
  if (parentKey === null) {
    const next = edit(tree);
    return next === tree ? tree : next;
  }

  let changed = false;
  const mapped = tree.map((node) => {
    if (node._key === parentKey) {
      const children = node.children ?? [];
      const next = edit(children);
      if (next === children) return node;
      changed = true;
      return { ...node, children: next };
    }

    if (node.children?.length) {
      const nextChildren = withList(node.children, parentKey, edit);
      if (nextChildren !== node.children) {
        changed = true;
        return { ...node, children: nextChildren };
      }
    }

    return node;
  });

  return changed ? mapped : tree;
}

/** Inserts `node` into `parentKey`'s list at `index`, clamped. Appends when `index` is omitted. */
export function insertAt(
  tree: BlockTree,
  node: BlockNode,
  parentKey: string | null = null,
  index?: number
): BlockTree {
  if (parentKey !== null && !find(tree, parentKey)) return tree;

  return withList(tree, parentKey, (list) => {
    const at = Math.max(0, Math.min(list.length, index ?? list.length));
    const next = [...list];
    next.splice(at, 0, node);
    return next;
  });
}

/** Removes `key` from wherever it is. Unknown keys leave the tree alone. */
export function removeByKey(tree: BlockTree, key: string): BlockTree {
  const at = locate(tree, key);
  if (!at) return tree;

  return withList(tree, at.parentKey, (list) => {
    const next = [...list];
    next.splice(at.index, 1);
    return next;
  });
}

/** Inserts `node` directly after `key`, in whichever list `key` lives in. */
export function insertAfter(tree: BlockTree, key: string, node: BlockNode): BlockTree {
  const at = locate(tree, key);
  if (!at) return tree;
  return insertAt(tree, node, at.parentKey, at.index + 1);
}

/**
 * Moves `activeKey` to `overKey`'s position, across containers if need be.
 *
 * ⚠️ **A container may not be dropped into its own subtree.** That would
 * detach the branch from the tree and lose every block in it — the move
 * removes the node before re-inserting, so the destination would no longer
 * exist. Refused by returning the tree unchanged.
 */
export function moveByKey(tree: BlockTree, activeKey: string, overKey: string): BlockTree {
  if (activeKey === overKey) return tree;

  const from = locate(tree, activeKey);
  const to = locate(tree, overKey);
  if (!from || !to) return tree;

  const active = find(tree, activeKey);
  if (!active || subtreeContains(active, overKey)) return tree;

  const detached = removeByKey(tree, activeKey);

  // Re-read the destination: removing the node shifts everything after it in
  // the same list, and computing the index before the removal is the classic
  // off-by-one this avoids.
  const target = locate(detached, overKey);
  if (!target) return tree;

  /**
   * ⚠️ **Dragging forward within one list lands AFTER the target, and without
   * this the drop is a silent no-op.**
   *
   * Removing the active block shifts the target back into the index the active
   * just left, so inserting at that index puts it straight back where it was:
   * `[X, Y]`, drop X onto Y, and the answer is `[X, Y]` again. Every backward
   * drag worked, every forward one did nothing, and nothing failed — the block
   * simply sprang back under the cursor. Found when columns made it obvious:
   * dragging the left column onto the right is the ordinary way anyone swaps
   * two of them.
   */
  const forward = from.parentKey === to.parentKey && from.index < to.index;

  return insertAt(detached, active, target.parentKey, target.index + (forward ? 1 : 0));
}

/**
 * Moves `activeKey` into `parentKey`'s list at `index` — the drop-into-a-gap
 * case, where the destination is a position rather than another block.
 */
export function moveInto(
  tree: BlockTree,
  activeKey: string,
  parentKey: string | null,
  index: number
): BlockTree {
  const active = find(tree, activeKey);
  if (!active) return tree;
  if (parentKey !== null && subtreeContains(active, parentKey)) return tree;

  const from = locate(tree, activeKey);
  if (!from) return tree;

  // Same list, and the gap is where the block already sits: nothing moves.
  if (from.parentKey === parentKey && (index === from.index || index === from.index + 1)) {
    return tree;
  }

  const detached = removeByKey(tree, activeKey);
  // Removing from earlier in the same list shifts the gap down by one.
  const shifted = from.parentKey === parentKey && index > from.index ? index - 1 : index;
  return insertAt(detached, active, parentKey, shifted);
}

/**
 * Which block a drop should land against, given what was dragged and what the
 * pointer resolved to.
 *
 * Usually the answer is "the block under the pointer", and that is what makes
 * dropping onto a nested block move the dragged block *into* its container — a
 * feature, and the only route into a non-empty one.
 *
 * ⚠️ **A block whose siblings sit side by side is the exception, and columns
 * are why this exists.** `closestCenter` picks the nearest droppable centre, and
 * a column's centre sits close to the centres of the blocks inside it, so
 * dragging one column across another routinely resolves to a block *within* the
 * neighbour rather than the neighbour itself. Left alone that nests the dragged
 * column inside its sibling — legal, since a column's slot is unrestricted, and
 * never what the gesture meant. Lifting the target back to the dragged block's
 * own list turns it into the reorder it looked like.
 *
 * Scoped by the slot's `direction` rather than applied to every drag, because
 * for a vertical list "drop onto the block inside the container" is the
 * behaviour, not the bug.
 */
export function dropTargetFor(tree: BlockTree, activeKey: string, overKey: string): string {
  const home = locate(tree, activeKey);
  if (!home) return overKey;

  const parent = home.parentKey === null ? null : find(tree, home.parentKey);
  if (!parent || manifestFor(parent._type)?.slot?.direction !== "horizontal") return overKey;

  return siblingIn(tree, home.parentKey, overKey) ?? overKey;
}
