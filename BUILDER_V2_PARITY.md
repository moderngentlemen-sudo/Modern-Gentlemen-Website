# Builder V2 parity contract

V2 is a new editor over the existing document contract, not a website rewrite.
Original and Canvas Preview remain intact. Original remains the default.
No conversion, migration, dependency change or public design change is implied.

## Architecture

- `/admin/pages/[id]/v2` has a fresh shell and canvas. Both routes call the same
  permission-checked loader and pass the same server actions by reference.
- V2 imports no Original Canvas, FreeCanvasControls or DnD controller. Its
  interaction geometry is independent; the document store is shared as a factory,
  with a separate instance for each mounted editor.
- The iframe provides an actual CSS viewport. Trusted registry components render
  through existing normalization, design and visual wrappers. Styles/theme are
  mirrored into the frame. No authored HTML or script is injected.
- Manifest field editors, fonts, media, validation, autosave, revisions, preview
  and publishing are reused. Products come from the published catalog, not seeds.
- Switching editors waits for saved state. Neither editor automatically publishes.

## Acceptance checklist

`Implemented` means code exists; browser verification is tracked in PROGRESS.md.

| Capability | V2 status |
| --- | --- |
| Original route and public rendering preserved | Required regression gate |
| Page loading, access control, payload/unknown-key preservation | Shared existing path |
| Save, preview, publish, revisions, page settings, template assignment | Shared existing controls |
| Element/section catalog, widget studio, patterns | Implemented |
| Nested selection, layer ordering, duplicate/delete/lock | Implemented |
| Font, media, typography and background field controls | Shared manifest controls |
| Independent CSS viewport and zoom | Implemented |
| Free movement, eight resize handles, edge/center snapping | Implemented |
| One undo entry per gesture, Escape/capture-loss cancellation | Implemented; regression gate |
| Grid placement inspector | Implemented |
| Direct grid gestures, group transforms, equal-spacing guides | Pending |
| Drag into nested slots / reorder by canvas drag | Pending; layers and click insertion available |
| Synced pattern visual expansion | Pending; safe reference/detach card available |
| Template/category/product/article V2 routes | Pending; existing editors retained |
| Full per-text-part controls across bespoke sections | Pending |
| Keyboard-only canvas movement and mobile pane ergonomics | Pending |
| Physical-device interaction / complete cross-browser visual parity | Pending |

Do not label V2 complete or replace Original until the pending rows have verified
implementations. New functionality must never rewrite content merely by opening it.
