# Signature Studio — Unified Workspace (1.4.0)

## One place to work

The root URL, `/design/index.html`, and `/blocks/index.html` now serve the same
workspace. Templates, global design controls, profile details, artwork, social
channels, draggable blocks, layers, selection, undo, saving and exports use one
document. There are no iframes or separate editor-mode handoffs.

The left rail contains Templates, Add blocks, Details, Design, Images, Social,
and Layers. Design has Type, Layout and Color tabs. Details has Profile and
Links & notes. The right inspector distinguishes the selected element from
whole-signature settings and shared profile content. Breadcrumbs select parents.

## Templates and elements

All 36 template presets compile into movable sections, columns and connected
content elements. Identity and contact groups can be separated into individual
fields; this explicit operation is undoable. The 14 foundation entries and ten
modules remain available on the same canvas. New identity, contact and social
library entries connect to the shared profile/channels by default. Other custom
blocks retain independent content with inherited global styling and local overrides.

Applying a template preserves profile data, artwork, supporting copy and added
blocks. Added blocks are moved below the new template composition, not silently
deleted. Undo restores their previous placement. The Keep my colors & fonts
option preserves the brand while changing composition. Saving a style stores the
global template/layout settings; use reusable groups or a project backup to keep
an exact custom block arrangement.

The template compiler recreates structural compositions, not pixel-identical
snapshots. Small spacing and placement differences may appear in migrated designs.
Existing source projects remain available unchanged in their original browser
storage. Classic editor recovery routes are `/design-classic`, `/blocks-classic`
and `/legacy`; they are not needed for ordinary unified editing.

## Shared data and migration

The bounded schema-v3 document remains compatible with existing Supabase project
storage. Its optional designData holds normalized template-specific settings,
assets, section content and channels; root identity/design are authoritative.
The first visit copies both earlier browser libraries into
`signature-studio.unified.v1`. Subsequent visits reuse that unified library.
Earlier storage keys are neither deleted nor overwritten. Browser-local saves
cannot move across browsers without JSON import or a cloud save.

A prior single preserved-template block becomes editable sections automatically.
If an old block document contains multiple independent preserved signatures, only
the first is connected to the primary profile; additional signatures retain their
own original composition and can edit their independent details in the inspector.
Cloud records are normalized when opened, but are not written until explicit save.

## Export and images

The shared block renderer and original named-section renderer produce the same
inline/table HTML for editing and export. Editing attributes, selection chrome and
drag handles are removed from exports. Design scale changes real export geometry;
workspace zoom only changes the view. Template images and custom image blocks use
the processed-image pipeline for crop, zoom, sizing and publication. Template image
resize handles update the same global image controls, with undo.

Local autosave, cloud save/load, HTML/PNG/JSON exports, image publication and guided
Gmail installation all use the shared document/controller. Editing or saving never
installs to Gmail. Direct OAuth configuration and database schema are unchanged.
Public image publication is still explicit; do not publish confidential artwork.

## Validation

Run `npm run check`, `npm test`, and `python tests/unified_browser.py`.
This release passed 179 Node tests (128 existing + 51 unified) and 24 offline
Chromium workflow groups, including actual pointer insertion, template image
resizing, direct text editing, profile/style synchronization, template changes,
undo/redo, both-library migration, local save/reload, HTML/PNG/JSON downloads and
all 36 compositions at a tested 360px target.

The browser harness executes production modules in scoped wrappers and uses local
asset/storage/secure-context shims because managed Chromium blocks local HTTP
navigation. It is not an end-to-end test of authenticated Supabase, production
Google OAuth, clipboard permissions, real Gmail paste or cross-email-client
rendering. Local HTTP routes are checked separately using an HTTP client.
