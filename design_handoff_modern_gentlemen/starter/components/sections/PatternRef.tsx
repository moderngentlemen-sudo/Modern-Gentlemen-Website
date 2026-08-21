/**
 * A synced pattern's placeholder on the **public** path.
 *
 * It renders nothing, and that is the whole component.
 *
 * A `patternRef` node is a pointer: `expandPatterns` replaces it with the
 * pattern's own blocks before the tree ever reaches `SectionRenderer`, so on a
 * correctly-resolved page this component is never mounted. It exists for the
 * one case where expansion could not resolve the reference — a pattern that was
 * deleted, unpublished, or reached through a cycle — because
 * `expandPatternsDetailed` deliberately **leaves the node in place** rather than
 * dropping it.
 *
 * Rendering nothing is the right answer to that. A visitor is not the person
 * who can fix a dangling reference, and an error card on a live editorial page
 * is worse than a gap. The editor-facing half of the same situation is loud:
 * the builder's canvas shows the reference as a card, `unresolved` names the
 * block, and preview shows exactly what publishing would produce.
 *
 * ⚠️ It still needs to be a real registered block with a manifest, which is why
 * this file exists at all rather than the renderer special-casing `_ref`.
 * `validateBlock` looks up `manifestFor(node._type)` and refuses an unknown
 * type, so a page holding a bare ref node could not be published — the feature
 * would fail at the last step, on the screen where an editor least expects it.
 */
export function PatternRef() {
  return null;
}
