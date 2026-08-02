/**
 * One depth-first walk over a block tree.
 *
 * Validation, binding collection and (Phase 5) media-usage extraction all need
 * to visit every node including nested `children`. Written once here so three
 * features don't grow three subtly different walkers — the kind of divergence
 * that shows up as "the media library thinks this asset is unused".
 */

import type { BlockNode, BlockTree } from "./types";

export interface BlockWalkContext {
  /** Keys of the ancestors, root first. Empty for a top-level block. */
  readonly ancestorKeys: readonly string[];
  readonly parent?: BlockNode;
  /** Position among its siblings. */
  readonly index: number;
}

export function walkBlocks(
  tree: BlockTree | undefined,
  visit: (node: BlockNode, context: BlockWalkContext) => void
): void {
  const descend = (nodes: BlockTree, ancestorKeys: string[], parent?: BlockNode) => {
    nodes.forEach((node, index) => {
      visit(node, { ancestorKeys, parent, index });
      if (node.children?.length) {
        descend(node.children, [...ancestorKeys, node._key], node);
      }
    });
  };

  descend(tree ?? [], []);
}

/** First node with this key, at any depth. */
export function findBlock(tree: BlockTree | undefined, key: string): BlockNode | undefined {
  let found: BlockNode | undefined;
  walkBlocks(tree, (node) => {
    if (!found && node._key === key) found = node;
  });
  return found;
}

/**
 * Structure-preserving map. Returns a new tree; the input is never mutated,
 * because the builder keeps undo history by holding on to previous trees.
 */
export function mapBlocks(
  tree: BlockTree | undefined,
  fn: (node: BlockNode, context: BlockWalkContext) => BlockNode
): BlockTree {
  const descend = (nodes: BlockTree, ancestorKeys: string[], parent?: BlockNode): BlockTree =>
    nodes.map((node, index) => {
      const mapped = fn(node, { ancestorKeys, parent, index });
      if (!mapped.children?.length) return mapped;
      return {
        ...mapped,
        children: descend(mapped.children, [...ancestorKeys, mapped._key], mapped),
      };
    });

  return descend(tree ?? [], []);
}

/** Every node, flattened depth-first. Convenient for counts and assertions. */
export function flattenBlocks(tree: BlockTree | undefined): BlockNode[] {
  const out: BlockNode[] = [];
  walkBlocks(tree, (node) => out.push(node));
  return out;
}
