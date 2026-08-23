import { defineBlock } from "../defineBlock";
import { DOCUMENT_CONTENT_GAP_TYPE } from "../templateContent";

/**
 * Transcribed from `components/sections/DocumentContentGap.tsx` — the marker
 * drawn as a visible band, spliced in by `/preview/[token]` when it is showing
 * a template with no page to frame.
 *
 * **No fields, for the same reason `documentContent` has none**: it occupies a
 * position, and a position is expressed by where the node sits in the tree.
 *
 * **`hidden` rather than `onlyIn`.** `documentContent` is offered inside a
 * template because an editor who deletes it must be able to put it back — that
 * is a repair path. This block has no repair path to protect: nothing an editor
 * does creates one, and nothing an editor does can lose one. Only the preview
 * route constructs it, exactly as only `insertPatternRef` constructs a
 * `patternRef`.
 */
export const documentContentGap = defineBlock({
  type: DOCUMENT_CONTENT_GAP_TYPE,
  label: "Page content (preview)",
  category: "layout",
  description:
    "Marks where a page's own sections will appear, when a template is previewed with no page to frame.",
  hidden: true,
  fields: {},
});
