/**
 * Where a document's own sections go inside a template. Renders nothing.
 *
 * The direct analogue of `PatternRef`, and for the same reason: a
 * `documentContent` node is a **marker**, not content. `applyTemplate` splices
 * the page's own blocks in its place before the tree ever reaches
 * `SectionRenderer`, so on a correctly-composed page this component is never
 * mounted.
 *
 * It exists for the case where composition did not happen — a template previewed
 * on its own, where there is no document to substitute. Rendering nothing is the
 * honest answer there: the preview shows the chrome the template contributes,
 * and the gap is exactly where the page's content will appear.
 *
 * ⚠️ It still has to be a real registered block with a manifest, which is why
 * this file exists rather than the renderer special-casing the type.
 * `validateBlock` refuses a `_type` with no manifest, so a template holding a
 * bare marker would compose, save and preview perfectly and then be refused at
 * publish — a failure at the last step, on the screen where an editor has least
 * reason to expect one. That is the trap `patternRef` documented and this block
 * inherits the fix for.
 */
export function DocumentContent() {
  return null;
}
