/**
 * Block-node construction for the builder.
 *
 * Kept apart from the store so the tricky parts — key generation and cloning —
 * are testable without spinning up state, and so the store reads as state
 * transitions rather than object surgery.
 */

import { manifestFor } from "@/lib/blocks/manifests";
import { flattenBlocks } from "@/lib/blocks/traverse";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

/**
 * A structural deep copy.
 *
 * `structuredClone` refuses frozen-but-otherwise-plain data in no environment
 * we target, but it does not exist in every test runtime, so JSON is the
 * fallback. Block payloads are JSON by definition — they round-trip through
 * `jsonb` — so nothing is lost either way.
 */
export function cloneJson<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A fresh block key.
 *
 * `_key` is identity: drag-and-drop reorders nodes, so position cannot be, and
 * `validateTree` reports duplicates as an error. The stale editor used
 * `blk_${Date.now()}_${counter}` where the counter resets on every page load,
 * so two tabs — or one reload mid-edit — could mint the same key.
 */
export function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `k_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `k_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
}

/** Every `_key` in a tree, including nested children. */
export function keysOf(tree: BlockTree | undefined): Set<string> {
  return new Set(flattenBlocks(tree).map((node) => node._key));
}

/** A key guaranteed not to collide with `existing`. */
function uniqueKey(existing: ReadonlySet<string>): string {
  let key = newKey();
  while (existing.has(key)) key = newKey();
  return key;
}

/**
 * A freshly inserted block, carrying its manifest's insert defaults.
 *
 * The clone is not defensive politeness. `defineBlock` freezes `insertDefaults`,
 * but `Object.freeze` is **shallow**: nested values such as
 * `latestGrid.insertDefaults.items[0]` are not frozen and are the *same object*
 * on every insert. A shallow spread would leave two inserted blocks sharing one
 * list item, so editing one would silently edit the other.
 */
export function newBlockNode(type: string, existing: ReadonlySet<string> = new Set()): BlockNode {
  const manifest = manifestFor(type);
  const taken = new Set(existing);

  const key = uniqueKey(taken);
  taken.add(key);

  const node: BlockNode = {
    _key: key,
    _type: type,
    settings: manifest ? cloneJson(manifest.insertDefaults as Record<string, unknown>) : {},
  };

  /**
   * Seeded children, for `columns` and nothing else today.
   *
   * Built here rather than in the store so every path that mints a block gets
   * them — the insert menu, drag-from-library and a test fixture alike. Keys
   * are taken from the same growing set as the parent's, because two children
   * minted from one `existing` snapshot could otherwise collide and fail the
   * tree's own duplicate-key validation.
   */
  if (manifest && manifest.insertChildren.length > 0) {
    node.children = manifest.insertChildren.map((childType) => {
      const child = newBlockNode(childType, taken);
      taken.add(child._key);
      return child;
    });
  }

  return node;
}

/**
 * A deep copy of `node` with every key in it — its own and every descendant's —
 * replaced. Duplicating a block that carries children and reusing their keys
 * would produce a tree that fails its own duplicate-key validation.
 */
export function cloneWithNewKeys(node: BlockNode, existing: ReadonlySet<string>): BlockNode {
  const taken = new Set(existing);

  const rekey = (source: BlockNode): BlockNode => {
    const key = uniqueKey(taken);
    taken.add(key);

    const copy: BlockNode = { ...cloneJson(source), _key: key };
    if (Array.isArray(source.children)) copy.children = source.children.map(rekey);
    return copy;
  };

  return rekey(node);
}
