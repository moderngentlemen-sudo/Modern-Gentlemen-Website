# 05 — Section Builder (drag-and-drop page composition)

This is the headline requirement: editors compose pages by **dragging pre-built, brand-styled section modules** into an ordered layout. The prototype already contains the raw material — `design_files/Modern Gentlemen Section Library.dc.html` holds **~125 brand-styled section modules** (a picker menu, not wired into any page). Turn each into a real React block, register it, and drive pages from an ordered array.

## Mental model
> A **page** is a document with a `sections[]` array. Each entry is a **block** = `{ _type, ...fields }`. A **registry** maps `_type → React component`. A **renderer** walks the array and renders each block. Editors reorder/add/remove entries via drag-and-drop; the same array drives the live site.

This is deliberately the Sanity "page builder" pattern — the CMS array editor gives you drag-and-drop authoring largely for free, and you can layer a richer visual editor on top later.

---

## 1. Block data model
```ts
// A block is a discriminated union on _type
type Block =
  | HeroCoverStar | LatestGrid | FeatureSplit | TwoUpCategory
  | StoryBand | FilmStills | Newsletter | PullQuote | ImageFull
  | ArticleList | ProductRow | /* …one per module you port… */ ;

interface BlockBase { _key: string; _type: string; }
interface HeroCoverStar extends BlockBase {
  _type: 'heroCoverStar';
  eyebrow?: string; headline: string; sub?: string;
  media: { kind: 'image'|'video'; image?: ImageRef; videoUrl?: string };
  mobileLayout?: 'stack'|'overlay'; mobileHeight?: 'auto'|'tall'|'fullscreen';
  cta?: { label: string; href: string };
}
// …each block type gets its own interface with ONLY the fields it needs.
```
Keep block prop contracts **small and explicit** — this is what makes the section reusable and editable. Don't dump a giant "props" bag.

## 2. Block registry + renderer
```tsx
// components/sections/registry.ts
import HeroCoverStar from './HeroCoverStar';
import LatestGrid from './LatestGrid';
// …
export const registry = {
  heroCoverStar: HeroCoverStar,
  latestGrid: LatestGrid,
  featureSplit: FeatureSplit,
  twoUpCategory: TwoUpCategory,
  storyBand: StoryBand,
  filmStills: FilmStills,
  newsletter: Newsletter,
  // …one entry per ported module
} as const;

// components/SectionRenderer.tsx
export function SectionRenderer({ sections }: { sections: Block[] }) {
  return <>{sections.map(b => {
    const Cmp = registry[b._type as keyof typeof registry];
    if (!Cmp) return process.env.NODE_ENV === 'development'
      ? <MissingBlock key={b._key} type={b._type} /> : null;
    return <Cmp key={b._key} {...(b as any)} />;
  })}</>;
}
```
Every page (`app/page.tsx`, category, about, membership, even articles' body) renders through `SectionRenderer`. That's what makes the whole site editor-composable.

## 3. Porting the 125 modules — do it in tiers
You do **not** need all 125 as distinct types. Most are variants of a smaller set. Recommended approach:
1. **Identify the ~12–18 distinct structural archetypes** in `Section Library.dc.html` (hero, editorial grid, split feature, two-up, quote band, full-bleed image, film/video row, newsletter, product row, stat/manifesto band, etc.). The library groups them: **1–68** section blocks, **69–115** hero treatments, **116–125** ten full-fidelity "Vogue" editorial heroes.
2. **Build one React component per archetype**, with a `variant` (or a few layout props) covering the sub-styles rather than 125 separate components. E.g. `FeatureSplit variant="imageLeft"|"imageRight"|"overlap"`.
3. **Map each library number → (blockType, variant)** so nothing is lost. Keep a `MODULE_MAP.md` (number → component + props) as you port; it's the bridge back to the prototype fidelity.
4. Port the 10 hand-built heroes (116–125) at full fidelity — those are the showcase pieces.

`design_files/Modern Gentlemen Homepage Layouts.dc.html` is a wireframe canvas of full-page compositions (Turn 7 = 10 "Hypebeast" feeds, Turn 6 = 10 "Vogue" editorial, etc.) — use it as a reference for **good default section orderings** (starter templates the builder can offer).

## 4. Authoring UX — two levels, ship in order

### Level A (ship first): CMS array editor
In Sanity, the page's `sections` is an `array` of block objects. The Studio gives editors **drag-to-reorder, add (from a typed list), duplicate, and remove** out of the box, with per-block field forms. Add each block type to the array's `of: [...]`, give each a `preview` (title + subtitle + icon/thumbnail) so the list reads like a real page. This satisfies "drag and drop sections" with almost no custom UI.

```ts
// sanity/schemas/page.ts (excerpt)
defineField({
  name: 'sections', type: 'array',
  of: [ {type: 'heroCoverStar'}, {type: 'latestGrid'}, {type: 'featureSplit'}, /* … */ ],
  options: { insertMenu: { views: [{name:'grid'}, {name:'list'}] } }, // grid = visual picker
})
```
Use Sanity's **insert menu grid view** with a thumbnail per block so the "add a section" experience is a **visual gallery** (mirrors the prototype's Section Library picker). Add **Presentation / visual editing** for click-to-edit on a live preview.

### Level B (optional, richer): in-app drag-and-drop canvas
If the brand wants a Webflow-like on-page builder rather than the Studio, build a client editor with **dnd-kit** (`@dnd-kit/sortable`):
- Left rail = the **section library gallery** (thumbnails of each block/variant), draggable.
- Center = the live page (`SectionRenderer`) with each block wrapped in a sortable, hoverable frame (drag handle, duplicate, delete, "edit fields" popover).
- Dragging a library item in inserts a new block with sensible defaults; dragging an existing block reorders it.
- Persist the resulting `sections[]` back to the CMS via a mutation.
- Reuse the exact same block components + registry — the editor just renders them inside sortable wrappers. **No duplicate section code.**

Skeleton:
```tsx
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={sections.map(s => s._key)} strategy={verticalListSortingStrategy}>
    {sections.map(b => (
      <SortableBlock key={b._key} id={b._key}>
        {registry[b._type] && React.createElement(registry[b._type], b)}
      </SortableBlock>
    ))}
  </SortableContext>
</DndContext>
```

## 5. Guidance for whoever builds this
- **One block = one component with a tight prop contract.** Variants via a `variant` prop, not new components, unless structurally different.
- **Full-bleed vs. contained** is a per-block concern — each block decides its own width behavior (`02 §Layout width`); the renderer just stacks them.
- Give every block a **thumbnail** (a small static PNG or an auto-generated preview) for the picker gallery — this is what makes drag-and-drop feel like the prototype's library.
- Keep blocks **content-driven** (all copy/media from props/CMS) — no hardcoded text inside a section component, so the same block works on any page.
- Start with the homepage's 8 sections (they're the highest-value blocks), then expand the library.
- Store starter **page templates** (named orderings of blocks) so editors can start from "Homepage — Cover Story" etc. rather than a blank page (seed from `Homepage Layouts.dc.html`).
