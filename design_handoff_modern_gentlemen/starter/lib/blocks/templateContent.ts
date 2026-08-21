/**
 * Template composition — splicing a document's own sections into a template.
 *
 * A template's `main` area is a block tree like any other, with one node of type
 * `documentContent` marking where the document being rendered contributes its
 * sections. This module replaces that node with those sections.
 *
 * Pure, with the document's blocks injected, exactly like `expand.ts` and the
 * binding engine. That is what lets the whole rule be unit-tested without a
 * database, and it is why the public route can stay a thin caller.
 *
 * **Why a marker rather than concatenation.** Two areas called `before` and
 * `after` would have been less code and strictly less expressive: a template
 * could bookend a page but never wrap it, so a full-bleed band around the
 * content — the most obvious thing a layout wants to do — would be impossible.
 * The marker also composes with nesting for free: put it inside a `column` and
 * the page renders inside that column, with no extra rule anywhere.
 *
 * ⚠️ **The substitution recurses into `children`.** A marker nested inside a
 * `columns`/`column` is the interesting case, not the edge case, so the walk has
 * to descend the same structural path every other traversal in this directory
 * descends. Skipping that would make the marker work at the top level and
 * silently do nothing one level down.
 */

import type { BlockNode, BlockTree } from "./types";

/** The block type that marks where a document's sections go. */
export const DOCUMENT_CONTENT_TYPE = "documentContent";

/**
 * The area a new template is seeded with. Mirrors `DEFAULT_AREA_NAME`.
 *
 * ⚠️ **This is a starting point, not the rendered area.** An earlier version of
 * this module hard-coded `main` as the area the page renderer reads, and the
 * templates E2E found the flaw in one run: it renames the only area to `body`,
 * which is a perfectly ordinary thing for an editor to do, and under a
 * name-based rule that silently unhooked the template from every page using it.
 * A magic name that must never be renamed is a trap, not a contract.
 *
 * `findContentArea` replaces it: **the marker identifies its own area**, so
 * names are cosmetic and a rename cannot break rendering.
 */
export const TEMPLATE_SEED_AREA = "main";

/** Every `documentContent` node in a tree, by `_key`, including nested ones. */
export function collectContentMarkers(tree: BlockTree | undefined): string[] {
  const keys: string[] = [];

  const walk = (nodes: BlockTree | undefined): void => {
    for (const node of nodes ?? []) {
      if (node._type === DOCUMENT_CONTENT_TYPE) keys.push(node._key);
      if (node.children?.length) walk(node.children);
    }
  };

  walk(tree);
  return keys;
}

/**
 * The template area with its marker replaced by `sections`.
 *
 * Returns the **document's own sections unchanged** when the template holds no
 * marker. That is the safe direction of the two: a template missing its marker
 * is a broken template, and rendering the page without its frame loses styling,
 * while rendering the frame without the page loses the article somebody came to
 * read. Publish validation refuses to let that template exist in the first
 * place; this is what happens if one does anyway.
 *
 * Non-mutating throughout, and it returns the original node reference wherever a
 * subtree contained no marker — the same structural-sharing contract the
 * builder's `tree.ts` keeps, so an untouched branch stays identical.
 */
export function applyTemplate(area: BlockTree | undefined, sections: BlockTree): BlockTree {
  if (!area?.length) return sections;
  if (collectContentMarkers(area).length === 0) return sections;

  const splice = (nodes: BlockTree): BlockTree => {
    const out: BlockNode[] = [];
    // Tracked rather than inferred from length: a marker replaced by exactly
    // one section leaves the count unchanged while the contents differ, and
    // returning `nodes` there would silently skip the substitution.
    let changed = false;

    for (const node of nodes) {
      if (node._type === DOCUMENT_CONTENT_TYPE) {
        // The marker is replaced by the sections, not wrapped around them: a
        // wrapper element here would be an extra DOM node the baselines never
        // saw, and the marker's whole job is to occupy a position.
        out.push(...sections);
        changed = true;
        continue;
      }

      if (node.children?.length) {
        const children = splice(node.children);
        if (children === node.children) {
          out.push(node);
        } else {
          out.push({ ...node, children });
          changed = true;
        }
        continue;
      }

      out.push(node);
    }

    return changed ? out : nodes;
  };

  return splice(area);
}

/**
 * The area holding the content marker, or `null` when no area does.
 *
 * This is what the page renderer reads, and it is deliberately keyed on the
 * marker rather than on a name. Areas have no stored order — `areas.ts` records
 * that jsonb sorts keys by length then bytewise — so when more than one area
 * holds a marker the choice between them would be arbitrary. Publish validation
 * refuses that state; here it resolves alphabetically so the behaviour is at
 * least deterministic rather than dependent on how Postgres happened to store
 * the object.
 */
export function findContentArea(areas: Record<string, BlockTree>): BlockTree | null {
  for (const name of Object.keys(areas).sort()) {
    if (collectContentMarkers(areas[name]).length > 0) return areas[name];
  }
  return null;
}
