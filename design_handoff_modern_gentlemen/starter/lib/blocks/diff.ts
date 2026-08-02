/**
 * Comparing two versions of a block tree.
 *
 * "What changed between version 4 and version 5?" is the question an editor
 * actually asks before rolling back, and a raw JSON diff answers it badly —
 * it reports key reordering and storage-shape differences as changes.
 *
 * Comparing by `_key` through `normalizeBlock` avoids both: a block that moved
 * from the legacy flat shape into `settings` is unchanged, a block that gained
 * a manifest default is unchanged, and only a real edit reads as an edit.
 */

import { normalizeBlock } from "./normalize";
import { walkBlocks } from "./traverse";
import type { BlockNode, BlockTree } from "./types";

export interface BlockTreeDiff {
  /** Present in the newer tree only. */
  added: string[];
  /** Present in the older tree only. */
  removed: string[];
  /** Same key, different props. */
  changed: string[];
  /** Same key and props, different position. */
  moved: string[];
  unchanged: string[];
}

interface Indexed {
  node: BlockNode;
  /** Position among siblings, qualified by ancestry, so a move is detectable. */
  position: string;
}

function index(tree: BlockTree | undefined): Map<string, Indexed> {
  const out = new Map<string, Indexed>();
  walkBlocks(tree, (node, context) => {
    if (!node._key) return;
    out.set(node._key, { node, position: [...context.ancestorKeys, context.index].join("/") });
  });
  return out;
}

export function diffBlockTrees(
  before: BlockTree | undefined,
  after: BlockTree | undefined
): BlockTreeDiff {
  const a = index(before);
  const b = index(after);

  const diff: BlockTreeDiff = { added: [], removed: [], changed: [], moved: [], unchanged: [] };

  for (const key of a.keys()) {
    if (!b.has(key)) diff.removed.push(key);
  }

  for (const [key, next] of b) {
    const previous = a.get(key);
    if (!previous) {
      diff.added.push(key);
      continue;
    }

    if (!sameProps(previous.node, next.node)) diff.changed.push(key);
    else if (previous.position !== next.position) diff.moved.push(key);
    else diff.unchanged.push(key);
  }

  return diff;
}

/** True when nothing about the tree differs. */
export function isUnchanged(diff: BlockTreeDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0 &&
    diff.moved.length === 0
  );
}

/** One-line summary for a history list: "2 added · 1 changed". */
export function summariseDiff(diff: BlockTreeDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (diff.moved.length) parts.push(`${diff.moved.length} moved`);
  return parts.join(" · ") || "no changes";
}

function sameProps(a: BlockNode, b: BlockNode): boolean {
  if (a._type !== b._type) return false;
  return stableStringify(normalizeBlock(a)) === stableStringify(normalizeBlock(b));
}

/**
 * JSON with object keys sorted, so two payloads that differ only in key order —
 * which they routinely do, since normalization emits manifest field order while
 * stored content keeps whatever order it was authored in — compare equal.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return `{${entries.join(",")}}`;
}
