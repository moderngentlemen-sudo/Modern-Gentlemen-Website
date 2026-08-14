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

import type { ZodObject, ZodRawShape } from "zod";
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
 *
 * `layout` is appended rather than inserted: the rail iterates these in
 * declaration order, so appending leaves every existing group where editors
 * already expect to find it.
 */
export const BLOCK_CATEGORIES = [
  "hero",
  "editorial",
  "commerce",
  "bands",
  "people",
  "layout",
] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

/**
 * A block's child slot: what `BlockNode.children` may hold.
 *
 * Singular by construction. `children` is one array, so a block has at most one
 * slot — named *areas* are a different shape (`{ areas: Record<string,
 * BlockTree> }`, which is why `BLOCK_TREE_KEY.template` is `null`) and a
 * different problem. Conflating the two doubles the work and buys nothing.
 *
 * Declaring a slot is what makes children legal at all: `validateBlock` refuses
 * children on a block whose manifest has none, so a container is opt-in and the
 * other twenty-two blocks stay leaves.
 */
export interface BlockSlot {
  /** Shown in the builder where the slot is edited. */
  readonly label: string;
  /** Types accepted as children. Omitted means any registered block. */
  readonly allow?: readonly string[];
  /** Publish-time bounds. `min` is what stops an empty container shipping. */
  readonly min?: number;
  readonly max?: number;
}

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
  /**
   * Same, but unknown keys are an error — used by publish validation. A
   * `ZodObject` rather than a bare schema because `validate.ts` calls `.omit()`
   * on it to lift out fields holding a `$bind` descriptor before parsing.
   */
  readonly strictSchema: ZodObject<ZodRawShape, "strict">;
  /** The props a freshly inserted block carries, so the canvas is never blank. */
  readonly insertDefaults: Readonly<Record<string, unknown>>;
  /** Field names that may hold a `$bind` descriptor instead of a literal value. */
  readonly bindable: readonly string[];
  /**
   * Declared only by container blocks. Its absence is the assertion that this
   * block is a leaf, and `validateBlock` enforces it.
   */
  readonly slot?: BlockSlot;
}
