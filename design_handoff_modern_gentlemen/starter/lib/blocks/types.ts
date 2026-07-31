/**
 * Block tree vocabulary — the shapes every other part of the builder speaks.
 *
 * `BlockNode` matches the tree documented in the header of
 * `supabase/migrations/0003_content_spine.sql`, which is what `draft_data` and
 * `published_data` hold for pages, templates, patterns and articles.
 *
 * The index signature is deliberate. Content written before the builder existed
 * (`lib/demo/home-sections.ts`, and everything `scripts/seed.ts` lifted from it)
 * spreads a block's editable props at the top level rather than nesting them
 * under `settings`. Both shapes are legal on the way in; `normalize.ts`
 * reconciles them. Dropping the signature would make the seeded homepage
 * un-typeable without a data migration.
 */

import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import type { FieldSet } from "./fields";

/** Per-block display rules. Reserved for the Phase 4 properties panel. */
export interface BlockVisibility {
  hidden?: boolean;
  devices?: ("mobile" | "tablet" | "desktop")[];
}

export interface BlockNode {
  /** Stable identity within a tree. Drag-and-drop reorders nodes, so index is not identity. */
  _key: string;
  _type: string;
  /** The canonical home for editable props. The builder always writes this shape. */
  settings?: Record<string, unknown>;
  children?: BlockNode[];
  visibility?: BlockVisibility;
  locked?: boolean;
  /** Points at a pattern; expanded at render time (Phase 3). */
  _ref?: string;
  /** Legacy flat props — see the note above. */
  [key: string]: unknown;
}

export type BlockTree = BlockNode[];

/**
 * Insert-menu grouping. The first four mirror the `pattern_categories` slugs
 * seeded by `0003_content_spine.sql` so the block picker and the pattern
 * library read as one library rather than two vocabularies.
 */
export const BLOCK_CATEGORIES = ["hero", "editorial", "commerce", "bands", "people"] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export interface BlockManifest {
  /** Matches the key in `components/sections/registry.ts`. Conformance asserts it. */
  readonly type: string;
  /** Insert-menu label. The single home for a block's human name. */
  readonly label: string;
  readonly category: BlockCategory;
  readonly description: string;
  readonly fields: FieldSet;
  /** Derived from `fields`. Strips unknown keys — used on the render path. */
  readonly schema: ZodObject<ZodRawShape>;
  /** Same, but unknown keys are an error — used by publish validation. */
  readonly strictSchema: ZodTypeAny;
  /** The props a freshly inserted block carries, so the canvas is never blank. */
  readonly insertDefaults: Readonly<Record<string, unknown>>;
  /** Field names that may hold a `$bind` descriptor instead of a literal value. */
  readonly bindable: readonly string[];
}
