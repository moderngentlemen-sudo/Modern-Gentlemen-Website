import { findBlock } from "@/lib/blocks/traverse";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

import { cloneWithNewKeys, keysOf } from "./node";

/**
 * The selected roots in document order, excluding a selected descendant when
 * one of its ancestors is selected too.
 *
 * A marquee can select both a container and something inside it. Saving both
 * would duplicate the child in the resulting pattern, so selection semantics
 * match duplicate/delete in the store: the highest selected branch wins.
 */
export function topmostSelectedKeys(
  tree: BlockTree,
  selected: ReadonlySet<string>,
  ancestorSelected = false
): string[] {
  const out: string[] = [];
  for (const node of tree) {
    const currentSelected = selected.has(node._key);
    if (currentSelected && !ancestorSelected) out.push(node._key);
    if (node.children) {
      out.push(
        ...topmostSelectedKeys(node.children, selected, ancestorSelected || currentSelected)
      );
    }
  }
  return out;
}

/**
 * A self-contained pattern payload for the current selection.
 *
 * Every key is reminted across the whole batch. A detachable insertion remints
 * again, but a synced pattern is expanded directly at render time; retaining
 * keys from the source document there would produce collisions if the new
 * reference were inserted beside its source.
 */
export function selectionAsPatternBlocks(
  tree: BlockTree,
  selectedKeys: readonly string[]
): BlockTree {
  const roots = topmostSelectedKeys(tree, new Set(selectedKeys));
  const taken = new Set<string>();
  const blocks: BlockNode[] = [];

  for (const key of roots) {
    const source = findBlock(tree, key);
    if (!source) continue;
    const copy = cloneWithNewKeys(source, taken);
    for (const copyKey of keysOf([copy])) taken.add(copyKey);
    blocks.push(copy);
  }

  return blocks;
}
