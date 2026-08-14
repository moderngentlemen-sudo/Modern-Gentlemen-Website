# Builder plan — drag-from-library, real drag tests, and a nested layout engine

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
> Scoped in a session that did not build any of it. **The findings are the part to trust** —
> each was read out of the code and is cited. The sizing is an estimate.

## Context

The builder at `/admin/pages/[id]` already drags — `Canvas.tsx` runs dnd-kit
(`DndContext` + `SortableContext` + `useSortable`) with a `PointerSensor` (6px activation)
and a `KeyboardSensor`, so sections reorder by mouse *or* keyboard. What it cannot do is
accept a block dragged **in** from the library, and it cannot nest.

`design_handoff_modern_gentlemen/05_SECTION_BUILDER.md` §Level B already specifies the
missing half — *"Left rail = the section library gallery … **draggable**"* and *"Dragging a
library item in inserts a new block with sensible defaults."* So slice 1 is a
designed-but-unbuilt feature, not a new idea.

### ⚠️ One thing that looks like work and is already done

`components/admin/builder/store.ts` already accepts an insertion index:

```ts
insert: (type, at) => {
  const node = newBlockNode(type, keysOf(get().tree));
  commit(null, (draft) => {
    const index = at ?? draft.length;
    draft.splice(Math.max(0, Math.min(draft.length, index)), 0, node as Draft<BlockNode>);
  });
  set({ selectedKey: node._key });
},
```

`at` is absolute, clamped, appending when omitted, and `store.test.ts` covers it ("inserts
at an index when given one"). `Builder.tsx` already passes one — it inserts *after the
current selection*, so building a page reads top-to-bottom.

**The store is not the gap.** The gap is that nothing can express a *drop* index: the
library's `onInsert` is `(type: string) => void`, and there are no drop targets.

---

## Slice 1 — Drag from the library, with an insertion indicator

No schema change, no design decisions, no new dependency. dnd-kit core/sortable/utilities
are already installed.

### The structural blocker to fix first

`DndContext` currently lives **inside `Canvas.tsx`, inside the `tree.length === 0`
ternary**. Two consequences:

- The library rail is outside the context, so cross-container dragging is **structurally
  impossible**, not merely unimplemented.
- **An empty page has no `DndContext` at all** — the case a new editor meets first.

Fix: hoist `DndContext` to `BuilderLayout` in `Builder.tsx` so it wraps the rail *and* the
canvas, and render it unconditionally. `SortableContext` stays in `Canvas.tsx`.

### The pieces

- **`InsertMenu.tsx`** — wrap each catalogue entry in `useDraggable({ id: "library:<type>" })`.
  **Keep the existing `onClick`**: it is the accessible path, it already works, and
  click-to-insert must not regress into a drag-only interaction.
- **Drop targets** — explicit gap droppables, `gap:N` for `N` in `0..tree.length`, between
  blocks and at both ends. Explicit gaps beat inferring from a hovered block's midpoint:
  unambiguous, they give the indicator a DOM home, and they are assertable. Register them
  only while a library item is active, so they never interfere with reordering.
- **`DragOverlay`** — a ghost carrying the section label. Crossing a 230px rail onto the
  canvas with no visible payload reads as broken; this is not polish.
- **`onDragStart` / `onDragOver` / `onDragEnd`** — track the active kind and hovered gap,
  draw a 2px accent rule at that gap, and dispatch on drop: `library:*` onto `gap:N` →
  `insert(type, N)`; block key onto block key → the existing `move`.
- **Collision detection** — `closestCenter` suits sorting and not thin gap droppables. Pass
  a function returning `pointerWithin` while a library item is active, `closestCenter`
  otherwise.
- **Empty canvas** — make the `EmptyState` itself a droppable resolving to index 0.

### Keep the maths pure

`dnd.ts`'s header states the philosophy: dnd-kit measures the DOM, jsdom has no layout
engine, so the canvas reduces a drag to keys and calls a pure function. Follow it — add
`parseDragId(id)` and `dropIndexFor(overId, treeLength)` beside `reorderByKey` and unit-test
them. The React layer stays a thin dispatcher.

### Tests

Unit tests for the new pure helpers; `Canvas.test.tsx` asserts the gaps render and the
empty state is droppable. **No simulated drags** — that is slice 2, and the existing file
is explicit about why jsdom cannot do it.

**Size: small–medium.** ~4 files, 2 with real logic.

---

## Slice 2 — Prove the drag in a real browser

`tests/e2e/builder.spec.ts` already mints a scratch page, composes it, publishes, rolls
back and cleans up — so this extends a host rather than building one.

- **Drive it with stepped `mouse.move` events, not `page.dragAndDrop()`.** The
  `PointerSensor` has `activationConstraint: { distance: 6 }`, so the pointer must travel
  more than 6px across several moves before dnd-kit engages. A single-shot helper typically
  does nothing while reporting success.
- Assert **order, not count**: read `[data-block-key]` in document order (the hook
  `Canvas.test.tsx` already uses) and check the block landed at the target index.
- Cover the empty-canvas drop specifically — the case slice 1 repairs.
- Reuse the scratch-page and cleanup discipline already in the file.

⚠️ **Expect this to be the flakiest test in the suite.** It is the first anywhere that
exercises a real drag. The session that wrote this plan lost three CI rounds to locator and
timing assumptions in specs that looked obviously correct — see the Playwright entries in
`PROGRESS.md`'s gotchas. Assert on state the app controls, never on pixels or transforms.

**Size: small, with a high flake-risk tail.**

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

| Slice | Gate |
|---|---|
| 1 | The four gates; `npm run build`; **16/16 baselines unmoved** (the builder is admin-only, so any movement means something leaked); unit tests for the new pure helpers |
| 2 | The E2E job in CI. Green **twice** before trusting it, given it is the suite's first real drag |
| 3 | All of the above **plus** a deep-compare of prerendered HTML before/after the `SectionRenderer` change, per the "proving a structural refactor is render-safe" recipe in `PROGRESS.md`, and a new baseline for the layout block |

## Recommended order

**1 → 2 → 3.** Slice 1 delivers the feature people notice and needs no further decisions.
Slice 2 protects it. Slice 3 is a project-shaping change that should not ride along with
either.
