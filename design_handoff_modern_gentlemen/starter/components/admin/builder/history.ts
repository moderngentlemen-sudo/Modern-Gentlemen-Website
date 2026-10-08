import { diffBlockTrees } from "@/lib/blocks/diff";
import { manifestFor } from "@/lib/blocks/manifests";
import { findBlock, flattenBlocks } from "@/lib/blocks/traverse";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

/**
 * Plain-language names for undo steps and blocks, for Focus's History pane and
 * command bar. Pure: the store keeps trees, this only reads them.
 */

/** The name an editor recognises: their own layer name first, then the block's label. */
export function blockLabel(node: BlockNode): string {
  return node.visual?.name || manifestFor(node._type)?.label || node._type;
}

const SNIPPET_FIELDS = [
  "heading",
  "title",
  "headline",
  "text",
  "content",
  "eyebrow",
  "label",
  "body",
];

/** A short piece of the block's own copy, so two "Text" blocks can be told apart. */
export function blockSnippet(node: BlockNode, max = 48): string | null {
  const settings = (node.settings ?? node) as Record<string, unknown>;
  for (const field of SNIPPET_FIELDS) {
    const value = settings[field];
    if (typeof value === "string" && value.trim()) {
      const flat = value
        .replace(/[*_#>`[\]()]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
    }
  }
  return null;
}

export interface HistoryStep {
  /** What happened, e.g. "Added Heading" or "Edited 3 blocks". */
  label: string;
  /** The block the step is about, when there is exactly one and it still exists after it. */
  key: string | null;
}

function named(tree: BlockTree, keys: string[], verb: string): HistoryStep {
  if (keys.length === 1) {
    const node = findBlock(tree, keys[0]);
    return { label: `${verb} ${node ? blockLabel(node) : "a block"}`, key: keys[0] };
  }
  return { label: `${verb} ${keys.length} blocks`, key: null };
}

/**
 * Describes one undo step: the change from `before` to `after`.
 *
 * Containers are excluded from "changed" when something inside them was added,
 * removed or moved, because the diff compares whole subtrees and would
 * otherwise report "Added Text" as "Added Text, edited Columns".
 */
export function describeStep(before: BlockTree, after: BlockTree): HistoryStep {
  const diff = diffBlockTrees(before, after);
  if (diff.added.length) {
    const roots = diff.added.filter(
      (key) => !diff.added.some((other) => other !== key && contains(after, other, key))
    );
    return { ...named(after, roots, "Added"), key: roots.length === 1 ? roots[0] : null };
  }
  if (diff.removed.length) {
    const roots = diff.removed.filter(
      (key) => !diff.removed.some((other) => other !== key && contains(before, other, key))
    );
    return { ...named(before, roots, "Removed"), key: null };
  }
  if (diff.moved.length) {
    const moved = diff.moved.length === 1 ? diff.moved : movedRoots(before, after, diff.moved);
    return named(after, moved, "Moved");
  }
  // The diff compares content only; lock, visibility and design live beside it.
  const presentation = flattenBlocks(after)
    .filter((node) => {
      const old = findBlock(before, node._key);
      return (
        old &&
        JSON.stringify([old.locked, old.visibility, old.design, old.visual]) !==
          JSON.stringify([node.locked, node.visibility, node.design, node.visual])
      );
    })
    .map((node) => node._key);
  if (diff.changed.length || presentation.length) {
    const changed = [...new Set([...diff.changed, ...presentation])].filter(
      (key) => !diff.changed.some((other) => other !== key && contains(after, key, other))
    );
    if (changed.length === 1) {
      const a = findBlock(before, changed[0]);
      const b = findBlock(after, changed[0]);
      if (a && b && !!a.locked !== !!b.locked)
        return named(after, changed, b.locked ? "Locked" : "Unlocked");
      if (a && b && !!a.visibility?.hidden !== !!b.visibility?.hidden)
        return named(after, changed, b.visibility?.hidden ? "Hid" : "Showed");
    }
    return named(after, changed, "Edited");
  }
  return { label: "Changed page settings", key: null };
}

/** True when `ancestor`'s subtree in `tree` holds `key`. */
function contains(tree: BlockTree, ancestor: string, key: string): boolean {
  const node = findBlock(tree, ancestor);
  return !!node?.children && flattenBlocks(node.children).some((child) => child._key === key);
}

/**
 * A single drag shifts every sibling it passes, so the diff reports them all
 * as moved. The block that actually travelled is the one whose neighbours
 * changed on both sides; when that cannot be told apart, report the count.
 */
function movedRoots(before: BlockTree, after: BlockTree, moved: string[]): string[] {
  const order = (tree: BlockTree) => flattenBlocks(tree).map((node) => node._key);
  const a = order(before);
  const b = order(after);
  const travelled = moved.filter((key) => {
    const i = a.indexOf(key);
    const j = b.indexOf(key);
    return a[i - 1] !== b[j - 1] && a[i + 1] !== b[j + 1];
  });
  return travelled.length === 1 ? travelled : moved;
}
