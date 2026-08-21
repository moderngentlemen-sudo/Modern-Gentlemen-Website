/**
 * Named areas — the payload shape a template keeps its block trees in.
 *
 * Every other document type holds one ordered list under a single key, which is
 * what `BLOCK_TREE_KEY` names. A template holds several:
 *
 *   { "areas": { "header": BlockNode[], "main": BlockNode[] }, ... }
 *
 * `BLOCK_TREE_KEY.template` is `null` because no single key can name that, and
 * `lib/services/documents.ts#blockTreesOf` has understood the shape since Phase
 * 3 — validation, revisions and diffing already cover every area. What was
 * missing was everything above the data layer, which is what this module and
 * the builder's area switcher supply.
 *
 * It is deliberately here rather than in `lib/domain`: an area holds a
 * `BlockTree`, and `lib/domain` is a leaf that does not know what a `BlockNode`
 * is. `lib/domain/templates.ts` keeps the parts that are strings — the `kind`
 * vocabulary — for exactly that reason.
 *
 * ⚠️ **Areas have no stored order, and cannot be given one by writing them in
 * order.** Postgres `jsonb` does not preserve key insertion order — it sorts
 * keys by length, then bytewise. Written as `{header, main, footer, a}` the
 * column reads back `{a, main, footer, header}`; that was measured against the
 * live project, not assumed. So `areaNames` sorts alphabetically and every
 * caller gets the same order for the same set, rather than an order that looks
 * like the editor's intent and silently is not. Giving areas a real order means
 * storing one beside them, and nothing yet needs it.
 */

import type { BlockTree } from "./types";

/** The payload key holding the map of areas. Mirrors `0003`'s column default. */
export const AREAS_KEY = "areas";

/** The area a new template is created with. Not privileged anywhere else. */
export const DEFAULT_AREA_NAME = "main";

/**
 * Area names are slug-shaped, for the same reason a pattern's key is: they are
 * handles that appear in a validation path (`areas.main.0.headline`), and a
 * name carrying a dot would make that path ambiguous to `stripTreePrefix`.
 */
export const AREA_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAreaName(value: string): boolean {
  return AREA_NAME_PATTERN.test(value);
}

/**
 * The builder's `treeKey` for an area — the dotted path into the payload.
 *
 * `BuilderDocument.treeKey` is a payload *path*, and for the five one-tree
 * types it happens to be a single segment. Templates are what make the
 * distinction visible.
 */
export function areaTreeKey(name: string): string {
  return `${AREAS_KEY}.${name}`;
}

/** The area a `treeKey` names, or `null` when it names a plain top-level key. */
export function areaNameOf(treeKey: string): string | null {
  const prefix = `${AREAS_KEY}.`;
  if (!treeKey.startsWith(prefix)) return null;
  const name = treeKey.slice(prefix.length);
  return isAreaName(name) ? name : null;
}

/**
 * Every area in a payload, skipping anything that is not an array.
 *
 * Tolerant on purpose: this reads a jsonb column that predates the editor, and
 * a template seeded by hand or left at `0003`'s `{"areas":{}}` default must
 * open rather than throw.
 */
export function readAreas(payload: unknown): Record<string, BlockTree> {
  const root = (payload ?? {}) as Record<string, unknown>;
  const areas = root[AREAS_KEY];
  if (!areas || typeof areas !== "object" || Array.isArray(areas)) return {};

  const result: Record<string, BlockTree> = {};
  for (const [name, tree] of Object.entries(areas as Record<string, unknown>)) {
    if (Array.isArray(tree)) result[name] = tree as BlockTree;
  }
  return result;
}

/** The area names in a payload, alphabetically — see the header on ordering. */
export function areaNamesOf(payload: unknown): string[] {
  return Object.keys(readAreas(payload)).sort();
}

/** One area's tree, or an empty one. An absent area reads as empty, not missing. */
export function readArea(payload: unknown, name: string): BlockTree {
  return readAreas(payload)[name] ?? [];
}

/**
 * A payload with one area replaced.
 *
 * Non-mutating, and it carries every other key through untouched — the same
 * contract the builder's `rest` has always had, so a save never drops a key the
 * builder does not edit.
 */
export function withArea(
  payload: Record<string, unknown>,
  name: string,
  tree: BlockTree
): Record<string, unknown> {
  return { ...payload, [AREAS_KEY]: { ...readAreas(payload), [name]: tree } };
}

/** A payload with one area removed. Removing an absent area is a no-op. */
export function withoutArea(
  payload: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const areas = readAreas(payload);
  delete areas[name];
  return { ...payload, [AREAS_KEY]: areas };
}

/**
 * A payload with one area renamed, keeping its blocks.
 *
 * Refuses to overwrite an existing area: a rename that silently merged two
 * areas would destroy one of them with no error, and the caller has the
 * information to refuse first.
 */
export function withRenamedArea(
  payload: Record<string, unknown>,
  from: string,
  to: string
): Record<string, unknown> {
  const areas = readAreas(payload);
  if (from === to || !(from in areas) || to in areas) return payload;

  const tree = areas[from];
  delete areas[from];
  return { ...payload, [AREAS_KEY]: { ...areas, [to]: tree } };
}
