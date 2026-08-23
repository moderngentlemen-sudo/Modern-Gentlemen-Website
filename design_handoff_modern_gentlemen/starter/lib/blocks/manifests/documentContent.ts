import { defineBlock } from "../defineBlock";

/**
 * Transcribed from `components/sections/DocumentContent.tsx` — the point in a
 * template where the document's own sections are spliced in.
 *
 * **No fields, deliberately.** The marker carries no configuration because it
 * has nothing to configure: it names a position, and a position is expressed by
 * where the node sits in the tree. Anything an editor might want to vary about
 * the content belongs to the document, not to the template that frames it.
 *
 * **`onlyIn: ["template"]` rather than `hidden`.** `column` and `patternRef` are
 * hidden because nothing should ever choose them from the library — one is
 * seeded by its row, the other is produced by inserting a synced pattern. This
 * one is different: an editor building a template *must* be able to place it,
 * and must be able to put it back after deleting it. Hiding it everywhere would
 * make a template unrecoverable from one keystroke. So it is offered, and
 * offered only where it means something.
 *
 * A template is created holding one already (`createTemplate`), the same way a
 * `columns` row arrives holding two columns — the library entry is the repair
 * path, not the normal one.
 *
 * ⚠️ **Exactly one, in `main`, is a publish rule** — see
 * `validateTemplateAreas`. Zero markers means a template that silently swallows
 * every page assigned to it; two means the page's sections would render twice.
 * Both are caught at publish, where there is an editor to tell.
 */
export const documentContent = defineBlock({
  type: "documentContent",
  label: "Page content",
  category: "layout",
  description:
    "Where the page's own sections appear inside this template. Every template needs exactly one, in the main area.",
  onlyIn: ["template"],
  fields: {},
});
