/**
 * Pattern expansion — replacing `_ref` nodes with the blocks they point at.
 *
 * A node carrying `_ref` is a *synced* pattern usage: the page stores a
 * pointer, and the pattern's blocks are substituted at render time, so editing
 * the pattern updates every page using it. (Detachable patterns are copied into
 * the page at insert time and have no `_ref` — nothing to expand.)
 *
 * Pure, with the pattern payloads injected, exactly like the binding engine.
 * That is what lets this be unit-tested without a database, and it reuses
 * `walkBlocks`/`mapBlocks` from `traverse.ts` rather than growing a third
 * walker over the same tree.
 */

import { walkBlocks } from "./traverse";
import type { BlockTree } from "./types";

/**
 * A pattern can contain a `_ref` to another pattern, so expansion recurses.
 * The depth cap is a backstop for a reference chain that is legitimately deep
 * but absurd; genuine cycles are caught precisely by the ancestor set.
 */
export const MAX_EXPANSION_DEPTH = 8;

export interface PatternRef {
  /** `_key` of the node holding the reference. */
  blockKey: string;
  patternId: string;
}

export function collectPatternRefs(tree: BlockTree | undefined): PatternRef[] {
  const refs: PatternRef[] = [];
  walkBlocks(tree, (node) => {
    if (typeof node._ref === "string" && node._ref) {
      refs.push({ blockKey: node._key, patternId: node._ref });
    }
  });
  return refs;
}

/**
 * Pulls the block list out of a pattern payload.
 *
 * Patterns store `{ blocks: [...] }` (`0003_content_spine.sql`), but a payload
 * that is already an array is accepted too — fixtures and tests routinely hand
 * over the bare list, and being strict there buys nothing.
 */
export function patternBlocks(payload: unknown): BlockTree {
  if (Array.isArray(payload)) return payload as BlockTree;
  if (payload && typeof payload === "object") {
    const blocks = (payload as Record<string, unknown>).blocks;
    if (Array.isArray(blocks)) return blocks as BlockTree;
  }
  return [];
}

export interface ExpansionResult {
  tree: BlockTree;
  /** Refs that could not be resolved — missing pattern, or a cycle. */
  unresolved: PatternRef[];
}

/**
 * Substitutes every `_ref` node for the pattern's blocks.
 *
 * An unresolvable reference leaves its node **in place** rather than dropping
 * it. A missing pattern is a content problem worth showing an editor; silently
 * deleting a section from a live page because a lookup failed is worse than
 * rendering nothing where it sat.
 */
export function expandPatternsDetailed(
  tree: BlockTree | undefined,
  patterns: ReadonlyMap<string, unknown>
): ExpansionResult {
  const unresolved: PatternRef[] = [];

  /**
   * `prefix` namespaces the keys of everything a pattern contributes.
   *
   * Keys must stay unique within the tree — the same pattern used twice on one
   * page would otherwise collide, and React would pair the wrong nodes. It is
   * threaded down rather than applied afterwards so that the keys reported in
   * `unresolved` are the keys that actually exist in the returned tree; an
   * editor cannot locate a block by a key the output does not contain.
   */
  const expand = (
    nodes: BlockTree,
    ancestors: ReadonlySet<string>,
    depth: number,
    prefix: string
  ): BlockTree =>
    nodes.flatMap((node) => {
      const key = prefix ? `${prefix}${node._key}` : node._key;
      const ref = typeof node._ref === "string" && node._ref ? node._ref : null;

      if (!ref) {
        const base = prefix ? { ...node, _key: key } : node;
        if (!node.children?.length) return [base];
        return [{ ...base, children: expand(node.children, ancestors, depth, prefix) }];
      }

      // `ancestors` catches a pattern that reaches itself, directly or through
      // others; the depth cap is the backstop for a chain that is merely absurd.
      const cyclic = ancestors.has(ref) || depth >= MAX_EXPANSION_DEPTH;

      if (cyclic || !patterns.has(ref)) {
        unresolved.push({ blockKey: key, patternId: ref });
        return [prefix ? { ...node, _key: key } : node];
      }

      const blocks = patternBlocks(patterns.get(ref));
      return expand(blocks, new Set([...ancestors, ref]), depth + 1, `${key}:`);
    });

  return { tree: expand(tree ?? [], new Set(), 0, ""), unresolved };
}

/** The common case, when the caller only wants the tree. */
export function expandPatterns(
  tree: BlockTree | undefined,
  patterns: ReadonlyMap<string, unknown>
): BlockTree {
  return expandPatternsDetailed(tree, patterns).tree;
}
