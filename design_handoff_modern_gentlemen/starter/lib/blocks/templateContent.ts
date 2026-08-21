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
 * The area a page template composes from.
 *
 * **Only `main` is rendered by the page renderer**, and that is a deliberate
 * narrowing rather than an oversight. Areas have no stored order — `areas.ts`
 * records that jsonb does not preserve key insertion order — so rendering "all
 * the areas" would mean rendering them alphabetically, which is an arrangement
 * no editor asked for and none could control. The templates phase refused
 * exactly that for preview, on the grounds that it "would render an arrangement
 * no renderer will ever produce"; inventing it here would be the same mistake
 * one layer down.
 *
 * Other areas remain legal, editable and versioned — they are what the `header`
 * and `footer` kinds will use. They simply do not appear on a page yet, and
 * `validateTemplateAreas` says so at publish rather than leaving an editor to
 * discover it from a blank page.
 */
export const TEMPLATE_MAIN_AREA = "main";

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
