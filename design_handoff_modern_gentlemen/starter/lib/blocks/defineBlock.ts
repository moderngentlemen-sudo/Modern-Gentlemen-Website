/**
 * `defineBlock()` — one declaration per section block.
 *
 * What a manifest is NOT: it holds no React component reference. `lib/blocks`
 * is a leaf in the layering (root CLAUDE.md), so it cannot import
 * `@/components/*`. The `_type → component` map stays in
 * `components/sections/registry.ts` and `conformance.test.ts` asserts the two
 * key sets are identical — which is what actually keeps them in step, rather
 * than a co-location that TypeScript would never check.
 *
 * A manifest with defaults that fail its own schema throws at module load. That
 * is deliberate: such a manifest would have the builder writing blocks that
 * publish validation then rejects, and the four gates run before anything is
 * committed, so the failure surfaces in CI rather than in an editor's face.
 */

import { z } from "zod";

import { fieldSetDefaults, fieldSetToZod, fieldToZod, type FieldSet } from "./fields";
import type { BlockCategory, BlockManifest, BlockSlot } from "./types";

export interface BlockSpec {
  /** Must equal the key this block has in `components/sections/registry.ts`. */
  type: string;
  label: string;
  category: BlockCategory;
  description: string;
  fields: FieldSet;
  /**
   * Props a freshly inserted block carries, over and above the field defaults.
   * Field defaults cover "what the component falls back to"; this covers "what
   * an editor sees after dragging the block in", which for a required field
   * with no component default is placeholder copy.
   */
  insertDefaults?: Record<string, unknown>;
  /** Field names that may hold a `$bind` descriptor instead of a literal value. */
  bindable?: readonly string[];
  /**
   * Keep this block out of the insert menu.
   *
   * For a block that is real, registered and validated but never chosen on its
   * own — `column`, which means nothing outside a `columns` row and is seeded
   * by it. Hidden from the library, not from the system: the canvas, the
   * validator, the renderer and the diff all treat it like any other block.
   */
  hidden?: boolean;
  /**
   * Restrict this block to the insert library of certain document types.
   *
   * `hidden` says "never offer this"; `onlyIn` says "offer this, but only
   * where it means something". `documentContent` is meaningless in a page —
   * a page *is* the content — and essential in a template.
   *
   * Deliberately `readonly string[]` and not `DocumentType[]`: `lib/blocks` is
   * a leaf and does not import `lib/domain`. The same split `lib/domain/
   * templates.ts` makes when it keeps the `kind` vocabulary as bare strings.
   * `blockCatalogFor` in the registry is where these strings meet the union.
   */
  onlyIn?: readonly string[];
  /**
   * Child block types a freshly inserted node is seeded with.
   *
   * `insertDefaults` is to fields what this is to the slot. A `columns` row
   * dropped onto the canvas arrives holding two empty columns, because a row
   * with no columns is not a thing anyone wants and making the editor assemble
   * one by hand would be a worse first impression than the flat list this
   * replaced.
   */
  insertChildren?: readonly string[];
  /**
   * Declared only by containers. Children live in `BlockNode.children` — the
   * structural home every traversal in `lib/blocks` already recurses into — and
   * NOT in a field, which is why this sits beside `fields` rather than in it.
   * Putting blocks in `settings` would route them around `walkBlocks`, and with
   * it around publish validation, media extraction, diffing and binding.
   */
  slot?: BlockSlot;
}

export function defineBlock(spec: BlockSpec): BlockManifest {
  const schema = fieldSetToZod(spec.fields);

  /**
   * The publish-path schema: strict about undeclared keys, because an
   * undeclared prop means a manifest has fallen behind its component.
   *
   * Built here rather than through `fieldSetToZod` so its type is a `ZodObject`
   * and not the strip/strict union that helper returns. `validate.ts` needs
   * `.omit()` on it to lift out fields holding a `$bind` descriptor.
   *
   * Note what is deliberately NOT done: making each bindable field a
   * `z.union([literal, descriptor])`. That validates correctly but reports a
   * failure inside a bound group as `invalid_union` at the group's own path, so
   * `article.href` collapses to `article` — and `BlockIssue.path` exists
   * precisely so the properties panel can focus the offending control.
   */
  const strictSchema = z
    .object(
      Object.fromEntries(
        Object.entries(spec.fields).map(([name, f]) => [name, fieldToZod(f, true)])
      )
    )
    .strict();

  const insertDefaults = Object.freeze({
    ...fieldSetDefaults(spec.fields),
    ...spec.insertDefaults,
  });

  const parsed = schema.safeParse(insertDefaults);
  if (!parsed.success) {
    throw new Error(
      `Block manifest "${spec.type}": insert defaults do not satisfy its own schema — ` +
        parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
    );
  }

  const bindable = Object.freeze([...(spec.bindable ?? [])]);
  for (const name of bindable) {
    if (!(name in spec.fields)) {
      throw new Error(
        `Block manifest "${spec.type}": "${name}" is marked bindable but is not one of its fields.`
      );
    }
  }

  if (
    spec.slot?.min !== undefined &&
    spec.slot.max !== undefined &&
    spec.slot.min > spec.slot.max
  ) {
    throw new Error(
      `Block manifest "${spec.type}": slot min (${spec.slot.min}) exceeds max (${spec.slot.max}).`
    );
  }

  return Object.freeze({
    type: spec.type,
    label: spec.label,
    category: spec.category,
    description: spec.description,
    fields: spec.fields,
    schema,
    strictSchema,
    insertDefaults,
    bindable,
    hidden: spec.hidden ?? false,
    onlyIn: spec.onlyIn ? Object.freeze([...spec.onlyIn]) : undefined,
    insertChildren: Object.freeze([...(spec.insertChildren ?? [])]),
    slot: spec.slot ? Object.freeze({ ...spec.slot }) : undefined,
  });
}
