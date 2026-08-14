# Builder plan — a nested layout engine

> ⚠️ **This is a plan, not a baseline. It is perishable by construction.**
>
> `design_handoff_modern_gentlemen/` is permanent design source-of-truth and this document
> deliberately does **not** live there. `PROGRESS.md` carries the condensed version of what
> follows; this is the long form, kept because the reasoning is worth more than the
> summary when someone finally builds it.
>
> **Where they disagree, the code wins and this file is the bug** — the same rule the block
> manifests follow. This repository's signature failure is a perishable fact outliving its
> truth (the current-branch line went stale five times before it was deleted rather than
> patched), so: **delete each slice from this file as it lands**, and delete the file when
> all three have. Do not "update" it into a record of what was built; that is `PROGRESS.md`'s
> job.
>
> **Slices 1 and 2 — drag-from-library and its browser test — are built, and have been
> deleted from here** by the session that built them, per the rule above. What they cost and
> what they taught is in `PROGRESS.md`'s decisions log. **Slice 3 is all that remains, and it
> is the one nobody has started.**
>
> Scoped in a session that did not build any of it. **The findings are the part to trust** —
> each was read out of the code and is cited. The sizing is an estimate.

## Context

The builder at `/admin/pages/[id]` drags in both directions now — sections reorder on the
canvas, and a section drags in from the library onto an explicit insertion point. Its
`DndContext` lives in `Builder.tsx`, wrapping the rail and the canvas together, and the
rules that decide what a drop *means* are pure functions in `dnd.ts`.

What it still cannot do is **nest**. Every mutation in `store.ts` is a `find`/`splice` on
the root array, and `SectionRenderer` maps a flat list.

---

## Slice 3 — The layout engine (arbitrary nesting)

**Decision: a full engine with arbitrary nesting and per-breakpoint control**, chosen over a
constrained grid built only from existing tokens.

⚠️ **This departs from the design baseline, deliberately.** The exception is recorded in
`design_handoff_modern_gentlemen/CLAUDE.md` beside the breakpoint rule it modifies — read it
there before starting, because that file otherwise forbids exactly this and a session
following the rules would be right to stop. The exception is narrow: a new layout block's
own responsive behaviour. Tokens, type scale, the 1320px column, motion timings and the
sixteen baselines are all untouched.

### What already exists, and it is a lot

The **data layer is largely nesting-ready**:

- `BlockNode.children?: BlockNode[]` is in `lib/blocks/types.ts` **and** in `0003`'s schema
  comment.
- `lib/blocks/traverse.ts` is fully recursive — `walkBlocks`, `findBlock`, `mapBlocks`,
  `flattenBlocks` — and `BlockWalkContext` already carries `parent` and `ancestorKeys`,
  exactly what a nested move needs.
- `validate.ts`, `expand.ts`, `media.ts`, `diff.ts` and `binding.ts` all already recurse,
  each with a test asserting it.
- `node.ts`'s `keysOf` and `cloneWithNewKeys` already recurse.

So **`children` is supported-but-dead infrastructure**. Nothing in the builder UI or store
reads or writes it.

### What must change, roughly in dependency order

1. **Manifest vocabulary.** `BlockManifest` has no way to declare child slots, and
   `fields.ts` has no field kind holding blocks. Add a slot/children policy (allowed types,
   min/max) and extend `lib/blocks/conformance.test.ts` to enforce it.
2. **`normalize.ts` strips `children`** — it is in `STRUCTURAL_KEYS`, so children never
   reach a component as props. That is correct and should stay; the *renderer* handles
   children explicitly instead.
3. **`components/SectionRenderer.tsx` is flat** (`sections.map`, no recursion). ⚠️ This
   touches the render path of **every public page**, so the 16 baselines are the gate.
4. **`store.ts` is flat in every mutation** — `insert`, `remove`, `duplicate`, `move`,
   `setSetting`, `setVisibility`, `setLocked` all use `draft.find`/`draft.splice` on the
   root array. Each needs a parent path; `insert(type, at)` becomes
   `insert(type, { parentKey, index })`. **This is the bulk, and the riskiest file here** —
   `commit` depends on immer reference identity (`next === before` means no-op) and undo
   holds whole previous trees cheaply *because* of structural sharing. Both survive nesting,
   but every recipe must keep them true.
5. **`dnd.ts`'s `reorderByKey` uses root `findIndex`** and cannot express "move into a
   container". Cross-container moves need a new pure function over paths.
6. **`PropertiesPanel.tsx` uses `tree.find`** — a nested block could never be selected or
   edited. Switch to `findBlock`. Note `store.ts` already uses `findBlock` for its lock
   check, so a nested block is *lock*-checkable but not *editable*: a latent inconsistency.
7. **`Canvas.tsx` needs nested `SortableContext`s**, one per container, plus dnd-kit
   multi-container dragging. The `[&_a]:pointer-events-none` wrapper and the absolutely
   positioned chrome both need care at depth.
8. **A new public layout component** and its responsive rules — where the invented
   breakpoints live. Needs its own baseline; the existing 16 must not move.

### Explicitly not in scope

**Templates' named areas.** `BLOCK_TREE_KEY.template` is `null` because templates hold
`{ areas: Record<string, BlockTree> }`, and `BuilderDocument.treeKey` is a single string, so
the builder still cannot open a template. `blockTreesOf` in `lib/services/documents.ts`
already handles areas for validation and revisions. **Nesting and areas are different
problems** — solving one does not solve the other, and conflating them doubles this slice.

**Size: large.** The riskiest work in the project so far, and the first to depart from the
design baseline on purpose.

---

## Verification

The four gates; `npm run build`; **16/16 baselines unmoved** (the builder is admin-only, so
any movement means something leaked); the E2E job in CI; **plus**, for this slice
specifically, a deep-compare of prerendered HTML before and after the `SectionRenderer`
change, per the "proving a structural refactor is render-safe" recipe in `PROGRESS.md`, and
a new baseline for the layout block.

⚠️ **Two gates the earlier slices learned the hard way, and this one inherits.** A drag
target below the fold cannot be dropped onto by a scripted Playwright drag — autoscroll
needs a human's dwell time — so an E2E drag must keep its targets in the viewport. And the
E2E suite **cannot run in a session container** at all, for want of credentials; the
substitute that worked was a throwaway harness route mounting the builder with fake
actions, driven by a plain Playwright script.
