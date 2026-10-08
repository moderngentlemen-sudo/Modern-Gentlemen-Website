import { manifestFor } from "@/lib/blocks/manifests";
import { findBlock } from "@/lib/blocks/traverse";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

import { keysOf, newBlockNode } from "./node";
import { insertAt, locate, removeByKey } from "./tree";

const RATIOS: Record<number, string> = { 2: "1-1", 3: "1-1-1", 4: "1-1-1-1" };

/**
 * Why `keys` cannot be put side by side, or `null` when they can.
 *
 * Two to four blocks (a row's legible maximum, as the columns manifest caps it),
 * all unlocked, all siblings in one list, none of them a column already, and in
 * a list whose container accepts a row.
 */
export function cannotWrapInColumns(tree: BlockTree, keys: readonly string[]): string | null {
  if (keys.length < 2 || keys.length > 4) return "Select two to four blocks.";
  const places = keys.map((key) => locate(tree, key));
  if (places.some((place) => !place)) return "A selected block is no longer on the page.";
  const parent = places[0]!.parentKey;
  if (places.some((place) => place!.parentKey !== parent))
    return "Select blocks that sit next to each other in the same container.";
  const nodes = keys.map((key) => findBlock(tree, key)!);
  if (nodes.some((node) => node.locked)) return "Unlock the selection first.";
  if (nodes.some((node) => node._type === "column")) return "Those are columns already.";
  if (parent) {
    const allow = manifestFor(findBlock(tree, parent)?._type ?? "")?.slot?.allow;
    if (allow && !allow.includes("columns")) return "This container cannot hold a row.";
  }
  return null;
}

/**
 * Replaces the selected sibling blocks with one Columns row, one block per
 * column in page order, placed where the first of them was. Returns the
 * original tree when refused, so a store commit records nothing.
 */
export function wrapInColumns(
  tree: BlockTree,
  keys: readonly string[]
): { tree: BlockTree; key: string | null } {
  if (cannotWrapInColumns(tree, keys)) return { tree, key: null };
  const ordered = [...keys].sort((a, b) => locate(tree, a)!.index - locate(tree, b)!.index);
  const { parentKey, index } = locate(tree, ordered[0])!;
  const taken = keysOf(tree);
  const row = newBlockNode("columns", taken);
  for (const key of keysOf([row])) taken.add(key);
  const children: BlockNode[] = ordered.map((key) => {
    const column = newBlockNode("column", taken);
    taken.add(column._key);
    return { ...column, children: [findBlock(tree, key)!] };
  });
  const wrapped: BlockNode = {
    ...row,
    settings: { ...row.settings, ratio: RATIOS[ordered.length] },
    children,
  };
  let next = tree;
  for (const key of ordered) next = removeByKey(next, key);
  return { tree: insertAt(next, wrapped, parentKey, index), key: wrapped._key };
}
