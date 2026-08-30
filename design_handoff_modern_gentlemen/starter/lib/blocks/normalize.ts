/**
 * Turning a stored block into the props a section component receives.
 *
 * Two shapes arrive here. The builder writes editable props under `settings`,
 * which is the shape `0003_content_spine.sql` documents. Everything authored
 * before the builder existed — `lib/demo/home-sections.ts` and the homepage
 * `scripts/seed.ts` lifted from it — spreads them at the top level. Both are
 * accepted; `settings` wins on conflict, since a node carrying both is one the
 * builder has since edited.
 *
 * **This code sits on the render path of every page, so it never throws and
 * never fails a render.** An unknown block type or a block that fails its own
 * schema falls through with its props untouched, rendering exactly as it did
 * before this module existed. Reporting bad content is `validate.ts`'s job, at
 * authoring time, where there is an editor to tell.
 */

import { manifestFor } from "./manifests";
import type { BlockNode } from "./types";

/** Keys that describe the node itself rather than its content. */
const STRUCTURAL_KEYS = new Set([
  "_key",
  "_type",
  "_ref",
  "settings",
  "children",
  "visibility",
  "design",
  "locked",
]);

/** The raw editable props of a node, with both storage shapes merged. */
export function blockProps(node: BlockNode): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!STRUCTURAL_KEYS.has(key)) flat[key] = value;
  }
  return { ...flat, ...(node.settings ?? {}) };
}

/**
 * Props ready to spread onto a section component: manifest defaults applied,
 * undeclared keys dropped. Idempotent — normalizing twice is normalizing once.
 */
export function normalizeBlock(node: BlockNode): Record<string, unknown> {
  const raw = blockProps(node);
  const manifest = manifestFor(node._type);
  if (!manifest) return raw;

  const parsed = manifest.schema.safeParse(raw);
  return parsed.success ? (parsed.data as Record<string, unknown>) : raw;
}
