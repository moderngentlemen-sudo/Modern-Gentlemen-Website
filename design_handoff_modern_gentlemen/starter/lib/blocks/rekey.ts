import type { BlockNode, BlockTree } from "./types";

function freshKey(taken: ReadonlySet<string>): string {
  let key: string;
  do {
    key =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `k_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
        : `k_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
  } while (taken.has(key));
  return key;
}

/** A JSON-deep copy of a block tree with globally fresh keys for this batch. */
export function rekeyBlockTree(tree: BlockTree): BlockTree {
  const taken = new Set<string>();

  function copy(source: BlockNode): BlockNode {
    const key = freshKey(taken);
    taken.add(key);
    const clone = (
      typeof structuredClone === "function"
        ? structuredClone(source)
        : (JSON.parse(JSON.stringify(source)) as BlockNode)
    ) as BlockNode;
    clone._key = key;
    if (Array.isArray(source.children)) clone.children = source.children.map(copy);
    return clone;
  }

  return tree.map(copy);
}
