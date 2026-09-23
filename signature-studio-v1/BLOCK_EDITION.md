# Signature Studio — Block Edition (1.3.0)

## Open

Use `/blocks/index.html`, or **Edit as blocks** in the existing Design Edition.
The default designer, its 36 templates, and `/legacy` remain unchanged.

## Included

- 14 foundation presets: identity, heading, text, contact item, contact group,
  social links, image, action, section, columns, group, divider, spacer, panel.
- 10 editable composed modules: campaign, announcement, partner lockup,
  editorial feature, event invitation, project spotlight, credentials,
  location/availability, locally generated QR card, personal/legal footer.
- Pointer drag/drop, highlighted insertion targets, group/column movement,
  explicit adjacent columns, image/column resize handles, click/tap insertion,
  move dialogs and keyboard alternatives.
- Live profile connections or independent content; local style overrides;
  safe inline bold/italic/link syntax; image crops; social artwork; full/reply
  visibility; repeatable blocks; independent reusable compositions.
- Bounded/versioned project schema, undo/redo, browser library, JSON backup,
  imported presets, optimistic cloud saves using the existing Supabase client.
- One table-based HTML renderer for preview and export. Editor controls never
  appear in exported HTML. Real export scaling, auto-fit and design warnings.
- HTML, 2x PNG and project exports; permission-free guided Gmail installation.

## Template preservation, not silent conversion

Every original template can be brought in as a **preserved template block**,
using the original renderer. New blocks may be placed around that block. This
is not a claim that its internal pieces immediately become independently editable.
**Make individually editable** is an explicit, undoable recomposition step:
information and artwork are carried into ordinary blocks, but exact positioning
and special template treatments can change. The original project is not replaced.
Opening a schema-v3 block project in Design Edition routes to Block Edition.

## Saving and images

Browser libraries, reusable-block presets and undo history are local to the
browser. Whole projects can be saved to Supabase and reopened across devices.
Only explicit cloud saves update cloud data; editing never installs a signature
in Gmail. Optimistic revisions avoid silently overwriting another saved version.
Publishing processed images is separate and explicit. Those images use public
URLs so recipients can load them; don't publish confidential artwork. Deleting a
project does not remove images that may still be referenced by sent emails.
A service-role key is neither required nor exposed by this application.

## Guardrails

Maximum 180 nodes, 9 levels, two nested column sections, 2–3 cells per columns
block, and 18 MB imported projects. SVG uploads are checked/rasterized by the
existing media pipeline. No arbitrary HTML, scripts, live embeds, or forms.
Website destinations are limited to HTTP(S); mail/phone links are field-specific.
QR destinations are encoded locally and limited to 400 ASCII URL characters.
Long signatures may need a simpler layout rather than unreadably small type.
The HTML character estimate does not reproduce Gmail's internal limit counter.

## Validation

Run `npm run check` and `npm test` (Node 22+; no npm install needed).
Run `python tests/blocks_browser.py` with Playwright, Chromium, OpenCV and NumPy.
The browser harness runs production modules in scoped offline wrappers with
embedded image fixtures and storage/crypto shims. It exercises real DOM and
pointer events, but does **not** validate real Supabase authentication,
Google OAuth, live Gmail paste, mailbox installation or cross-email-client
rendering. Those require an authorized live environment. Direct Gmail OAuth
configuration is intentionally unchanged in this release.
