import { defineBlock } from "../defineBlock";

/**
 * Transcribed from `components/sections/PatternRef.tsx` — a *synced* pattern's
 * place in a page.
 *
 * **It has no fields, and that is deliberate.** Which pattern the node points
 * at lives in `BlockNode._ref`, beside `_key` and `_type`, not in `settings`.
 * `_ref` is where `0003`'s schema comment puts it, where `normalize.ts`
 * preserves it and where `lib/blocks/expand.ts` reads it — putting a copy in a
 * field as well would give the same fact two homes, and the day they disagreed
 * the page would render one pattern and report another.
 *
 * So the manifest describes a block with nothing to edit. That is not a
 * degenerate case: a synced pattern has no per-usage settings *by definition* —
 * every page using it shows the same blocks, which is the entire difference
 * from a detachable one. Anything an editor wants to vary belongs in a copy.
 *
 * ⚠️ **The manifest exists for publish validation, not for the properties
 * panel.** `validateBlock` refuses a `_type` with no manifest, so without this
 * file a page holding a synced pattern would compose, save and preview
 * perfectly and then be refused at publish with "Unknown block type
 * patternRef" — a failure at the last step, on the screen where an editor has
 * least reason to expect one.
 *
 * ⚠️ **Not offered in the insert menu.** A ref is never built from the block
 * library; it is produced by inserting a pattern whose `sync_mode` is `synced`,
 * which is the only place a pattern id comes from. An entry here would offer a
 * block that could only ever point at nothing. Same reasoning as `column`.
 */
export const patternRef = defineBlock({
  type: "patternRef",
  label: "Synced pattern",
  category: "layout",
  description:
    "A reference to a saved pattern. Its blocks are substituted at render time, so editing the pattern updates every page using it.",
  hidden: true,
  fields: {},
});
