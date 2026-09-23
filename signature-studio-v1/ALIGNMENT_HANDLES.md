# Signature Studio 1.4.1 — Canvas alignment and selection

This patch adds editor-only move, resize and spacing controls to the existing
unified workspace. The exported document remains a flow-based email layout.

## Controls

- A canvas grip moves selected content into highlighted row/column targets.
  Click the grip for the existing non-drag Move to dialog.
- Image corner/edge handles resize independent images and shared template
  artwork. Aspect ratio is preserved by default; Shift enables independent
  image/banner dimensions. QR artwork remains square.
- Text/group side handles change an actual content-width table in the export.
- Columns expose each divider, including the second divider in a three-column
  composition. Only the adjacent pair changes. Nested columns use local widths.
- Spacing handle mode adjusts the four per-block padding insets. Inspector
  fields can also set exact values or clear an override.
- Grid and Snap are separate controls. Grid steps are 4, 8 (default), 12, 16,
  or 24 unscaled design pixels. Alt bypasses snap. Arrow keys work on focused
  handles; Alt + arrow makes one-pixel adjustments.
- Left, Center and Right align the selected content, respecting local overrides.
- Grid, handle-mode and snapping preferences are saved in this browser only.
  Actual widths, padding, alignment and proportions save in the project.

The grid is a sizing/spacing increment guide, not an absolute-position canvas.
Moving a block snaps to structural row/column targets. Grid points do not
force every existing template's origin or spacing to be a multiple of the step.
Resizing stays bounded by the existing image, padding and column constraints.

## Selection

Clicking blank stage, email body, row padding or inter-block whitespace clears
selection, handles, floating controls and the layer highlight. Clicking other
content selects it. Inspector inputs, tool controls, dialogs and layers retain
the selection so editing is not interrupted. Active inline text commits on blur.
Escape clears selection or cancels an active gesture without saving that change.
Lost pointer capture, pointer cancellation and window blur cancel a gesture.
A gesture commits one undo transaction, not one transaction per pointer event.

## Compatibility and implementation

The overlay/grid/readout/handles are separate DOM nodes and never enter HTML
or PNG export. Export geometry uses the existing table renderer; no absolute
positioning or scripts are added to a signature. Grid geometry accounts for both
workspace zoom and export scaling. Pointer-capture handling follows the W3C
Pointer Events specification: https://www.w3.org/TR/pointerevents/ .

## Verification

- 210 Node tests: all 179 existing tests plus 31 alignment/geometry checks.
- 34 new offline Chromium workflow groups for real mouse and touch-pointer
  drags, keyboard resizing, all handle modes, nested/three-column resizing,
  preferences, click-away behavior, inline-edit blur, gesture cancellation,
  undo/export parity, and a 390px viewport.
- Existing offline suites: 24 unified and 23 block workflow groups.

The browser harness uses production modules with documented offline asset,
storage and crypto shims. It does not verify live cloud authentication, Google
OAuth, clipboard permissions, Gmail installation or recipient rendering.
No database schema, OAuth credentials, production MG website or main-branch
changes are required. Only the signature-studio-v1 application is updated.
