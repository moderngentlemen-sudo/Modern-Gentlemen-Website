/**
 * Dynamic binding — letting a block say "the six newest Culture stories"
 * instead of carrying six hand-copied cards that go stale the day after they
 * are written.
 *
 * A bound field holds a `{ $bind: … }` descriptor where a literal value would
 * normally sit. Which fields may be bound is declared per block by
 * `manifest.bindable`, so an editor cannot bind a headline to a product feed.
 *
 * **The engine performs no I/O.** It collects descriptors, hands them to an
 * injected `BindingSource`, and folds the answers back into the tree. That is
 * what keeps `lib/blocks` a leaf: the demo source in `sources/demo.ts` reads
 * the existing demo modules today, and a Supabase source slots in behind the
 * same interface in Phase 7 without this file changing.
 */

import {
  bindingDescriptorSchema,
  bindingQuerySchema,
  isBindingDescriptor,
  type BindingDescriptor,
  type BindingQuery,
} from "./bindingDescriptor";
import { isField, type Field } from "./fields";
import { manifestFor } from "./manifests";
import { blockProps } from "./normalize";
import { mapBlocks, walkBlocks } from "./traverse";
import type { BlockNode, BlockTree } from "./types";

/**
 * The descriptor shape itself lives in `./bindingDescriptor` so that publish
 * validation can recognise a binding without importing this module — which
 * imports the manifests, which import `defineBlock`. Re-exported here so
 * callers still see one binding API.
 */
export {
  bindingQuerySchema,
  bindingDescriptorSchema,
  isBindingDescriptor,
  type BindingQuery,
  type BindingDescriptor,
};

/** One descriptor found in a tree, with enough context to put the answer back. */
export interface BindingRequest {
  /** `${blockKey}.${field}` — unique within a tree, since keys are. */
  id: string;
  blockKey: string;
  blockType: string;
  field: string;
  query: BindingQuery;
}

export function collectBindings(tree: BlockTree | undefined): BindingRequest[] {
  const requests: BindingRequest[] = [];

  walkBlocks(tree, (node) => {
    const manifest = manifestFor(node._type);
    if (!manifest) return;

    const props = blockProps(node);
    for (const fieldName of manifest.bindable) {
      const value = props[fieldName];
      if (!isBindingDescriptor(value)) continue;

      requests.push({
        id: `${node._key}.${fieldName}`,
        blockKey: node._key,
        blockType: node._type,
        field: fieldName,
        query: bindingQuerySchema.parse(value.$bind),
      });
    }
  });

  return requests;
}

/**
 * Folds resolved values back into the tree, writing them to `settings` — the
 * canonical shape — so a resolved node round-trips through `blockProps`
 * whichever shape it arrived in. Unresolved descriptors are left alone rather
 * than blanked: a source that failed should not silently empty a page.
 */
export function applyBindings(
  tree: BlockTree | undefined,
  resolved: ReadonlyMap<string, unknown>
): BlockTree {
  return mapBlocks(tree, (node) => {
    const manifest = manifestFor(node._type);
    if (!manifest?.bindable.length) return node;

    const props = blockProps(node);
    let patch: Record<string, unknown> | undefined;

    for (const fieldName of manifest.bindable) {
      if (!isBindingDescriptor(props[fieldName])) continue;

      const id = `${node._key}.${fieldName}`;
      if (!resolved.has(id)) continue;

      (patch ??= {})[fieldName] = project(manifest.fields[fieldName], resolved.get(id));
    }

    return patch ? withSettings(node, patch) : node;
  });
}

function withSettings(node: BlockNode, patch: Record<string, unknown>): BlockNode {
  return { ...node, settings: { ...(node.settings ?? {}), ...patch } };
}

/**
 * Trims a resolved record to the keys the target field actually declares.
 *
 * A source returns whatever it holds — the demo article rows carry `category`
 * and `lead` so queries can filter on them — but a block's item shape is closed,
 * and publish validation rejects undeclared keys. Projecting here means a
 * binding works whenever the names line up, and `map` stays for the case where
 * they genuinely differ, rather than being boilerplate on every binding.
 */
function project(field: Field | undefined, value: unknown): unknown {
  if (!field || value === null || value === undefined) return value;

  if (field.kind === "list") {
    if (!Array.isArray(value) || isField(field.of)) return value;
    const keys = Object.keys(field.of);
    return value.map((row) => pick(row, keys));
  }

  if (field.kind === "group") return pick(value, Object.keys(field.fields));

  return value;
}

function pick(value: unknown, keys: string[]): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface BindingSource {
  /** Returns a list, or a single record when `query.single` is set. */
  fetch(query: BindingQuery): Promise<unknown> | unknown;
}

/** Keyed by `BindingQuery.source`. */
export type BindingSources = Readonly<Record<string, BindingSource>>;

/**
 * Collect → fetch → apply. Requests run concurrently; one failing source does
 * not take the others down, and its field keeps whatever it had.
 */
export async function resolveBindings(
  tree: BlockTree | undefined,
  sources: BindingSources
): Promise<BlockTree> {
  const requests = collectBindings(tree);
  if (requests.length === 0) return tree ?? [];

  const settled = await Promise.all(
    requests.map(async (request) => {
      const source = sources[request.query.source];
      if (!source) return null;
      try {
        return [request.id, await source.fetch(request.query)] as const;
      } catch {
        return null;
      }
    })
  );

  return applyBindings(tree, new Map(settled.filter((entry) => entry !== null)));
}

/**
 * Applies a query's `map`, `sort` and `limit` to plain rows. Every source needs
 * this and none of it is source-specific, so sources implement only the reading.
 */
export function shapeRows(rows: Record<string, unknown>[], query: BindingQuery): unknown {
  let out = [...rows];

  if (query.sort) {
    const { field, direction } = query.sort;
    const sign = direction === "asc" ? 1 : -1;
    out.sort((a, b) => sign * compare(a[field], b[field]));
  }

  // Offset then limit, in that order: the limit counts rows the caller keeps,
  // not rows it skipped past. Reversing them would make `offset: 1, limit: 6`
  // return five.
  const start = query.offset ?? 0;
  if (start > 0 || query.limit !== undefined) {
    out = out.slice(start, query.limit === undefined ? undefined : start + query.limit);
  }

  const shaped: unknown[] = query.pluck
    ? out.map((row) => row[query.pluck!])
    : query.map
      ? out.map((row) => renameKeys(row, query.map!))
      : out;

  return query.single ? (shaped[0] ?? null) : shaped;
}

function renameKeys(
  row: Record<string, unknown>,
  map: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [target, sourceKey] of Object.entries(map)) out[target] = row[sourceKey];
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
