/**
 * Media references inside a block tree.
 *
 * This answers one question — "which `image` and `video` fields in this tree
 * hold a value, and where exactly?" — and deliberately stops there. It does not
 * know what a bucket is, which URLs belong to this project, or that a
 * `media_usages` table exists. `lib/blocks` is a leaf: it reports what the
 * manifests describe, and `lib/services/media.ts` decides what any of it means.
 *
 * The walk is `traverse.ts#walkBlocks`, which its own docblock has named as
 * this feature's walker since Phase 2. A second walker written here is exactly
 * the divergence that shows up later as "the media library thinks this asset is
 * unused".
 */

import { isField, type Field, type FieldSet } from "./fields";
import { manifestFor } from "./manifests";
import { blockProps } from "./normalize";
import { walkBlocks } from "./traverse";
import type { BlockTree } from "./types";

export interface MediaReference {
  /** `_key` of the block holding it. */
  key: string;
  /** Block type, for a human-readable "used on" listing. */
  type: string;
  /** Dotted path within the block's props, e.g. `stills.1.image`. */
  fieldPath: string;
  /** Which field kind declared it — an editor cares that a poster is a poster. */
  kind: "image" | "video";
  /** The stored value, verbatim. Resolving it to an asset is the caller's job. */
  url: string;
}

/**
 * Every media-valued field in the tree, in document order.
 *
 * Paths use the same shape as `BlockIssue.path` — dotted, with list positions
 * as numeric segments — so a usage record and a validation issue point at the
 * same control. That is what lets the library say "used by the film strip's
 * third still" rather than "used somewhere on this page".
 */
export function collectMediaReferences(tree: BlockTree | undefined): MediaReference[] {
  const found: MediaReference[] = [];

  walkBlocks(tree, (node) => {
    const manifest = manifestFor(node._type);
    // An unregistered block type has no field descriptions, so there is nothing
    // to read its props against. `validateTree` reports it as an issue; here it
    // is simply invisible.
    if (!manifest) return;

    const key = typeof node._key === "string" ? node._key : "";
    const props = blockProps(node);
    const collected: Omit<MediaReference, "key" | "type">[] = [];
    fromFieldSet(manifest.fields, props, [], collected);

    for (const reference of collected) found.push({ key, type: node._type, ...reference });
  });

  return found;
}

type Collected = Omit<MediaReference, "key" | "type">;

function fromFieldSet(fields: FieldSet, value: unknown, path: string[], out: Collected[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;

  for (const [name, field] of Object.entries(fields)) {
    fromField(field, record[name], [...path, name], out);
  }
}

function fromField(field: Field, value: unknown, path: string[], out: Collected[]): void {
  if (value === undefined || value === null) return;

  switch (field.kind) {
    case "image":
    case "video":
      // A bindable field holds `{ $bind: … }` rather than a string when it is
      // bound, and the type guard is all it takes to skip it. That is the right
      // answer, not merely a convenient one: the images inside a bound query's
      // results belong to the articles or products they came from, and those
      // entities carry their own usage records. A page that lists them does not
      // own them.
      if (typeof value === "string" && value !== "") {
        out.push({ fieldPath: path.join("."), kind: field.kind, url: value });
      }
      return;

    case "group":
      fromFieldSet(field.fields, value, path, out);
      return;

    case "list":
      if (!Array.isArray(value)) return;
      value.forEach((item, index) => {
        const itemPath = [...path, String(index)];
        if (isField(field.of)) fromField(field.of, item, itemPath, out);
        else fromFieldSet(field.of, item, itemPath, out);
      });
      return;

    default:
      // text, textarea, richText, url, select, number, boolean — a `url` field
      // is a link to a page, not a reference to an asset, and is deliberately
      // not collected.
      return;
  }
}
