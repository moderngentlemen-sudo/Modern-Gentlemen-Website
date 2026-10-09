# Signet (working name) — Signature Studio

An email-signature product: a drag-and-drop builder, a Quick mode with simple
forms, Canva import, clickable business cards and a shareable digital card.
Signatures paste straight into Gmail. Product plan and name shortlist:
[`docs/PRODUCT.md`](docs/PRODUCT.md).

- **Drag-and-drop builder:** rows of columns of 25 kinds of block, layers,
  inspector, per-block style and panels, new-email/reply visibility, keyboard
  shortcuts, undo; works with touch. Every layout compiles to Gmail-safe tables.
- **Brand kit:** colours, fonts, logo, company — for new signatures and on demand.
- **Builder quality of life:**
  - Canvas handles: resize handles on every corner and edge of photos, logos, images, QR codes, text and more (spacers: top and bottom), plus a drag grip. Blocks keep their proportions; dragging outward grows, inward shrinks.
  - Canvas zoom.
  - Double-click a block to edit it.
  - Copy and paste blocks.
  - Layers with hide/show and move up/down.
  - Search in the block palette.
- **More blocks:**
  - QR code, logo row (awards, partners), icon line and tag.
  - Ready-made combinations: promo card, event, testimonial, office hours, "We're hiring", contact row.
- **Zoom & crop** for the photo, the logo and any image block: drag to reposition, scroll to zoom, choose a frame shape.
- **Overall size:** scale a whole signature from 70% to 150% with one control.
- **Saved details:** contact details, social links and photo are entered once and shared by every linked signature.
- **Live checks:** email typos, numbers phones can't dial, broken links, hard-to-read colours, small text, missing image descriptions and logos that vanish in dark mode. Each check has a "Fix" button, and a size meter shows the Gmail character budget.
- **Quick start:** three questions, then three designs made with your details. You can paste your old signature or import a contact card (.vcf).
- **My templates:** save any design (without personal details) and reuse it.
- **Exports:** a PNG image, a print-ready business card (save it as a PDF from the print dialog), and HTML.
- **Snapping:** resize handles and column edges snap to matching sizes and even splits. Hold Alt to resize freely. Double-click text on the canvas to edit it in place.
- **Text formatting:** one toolbar for every text block: font (previewed in its own face), weight, size, bold/italic/underline/strike, case (incl. small capitals), colour role (text, muted, accent or custom) and spacing. Select words to make them bold, italic, underlined, struck through, highlighted or coloured, in the inspector or on the canvas (⌘B/⌘I/⌘U). Quotes, dashes and ellipses tidy themselves as you type.
- **Colours:** every colour picker offers this signature's colours and the brand kit first, then recent colours, a hex field and an eyedropper.
- **Text links:** select words and press ⌘K (in the inspector or right on the canvas) to link them to a website, email or phone number. Text, name, title and detail blocks can also link as a whole.
- **Hover text:** a tooltip on any linked block or image. Gmail strips hover styles, so tooltips are what survives in the inbox. The editor highlights links on hover, and the digital card page has hover effects.
- **Multi-select:** Shift- or ⌘-click blocks (on the canvas or in Layers) to restyle, hide, duplicate or delete them together, or put them side by side or in a panel.
- **Drop beside:** drop a block on another block's left or right edge to place them side by side. A vertical guide shows where it will go.
- **Version history:** save named versions and restore any of them. Restoring saves the current design first and can be undone.
- **Separate reply layout:** replies can be compact, use the same design, or have their own builder layout.
- **Installable app:** install Signet from the browser; it then works offline.
- **Seasonal library:** 14 seasonal and promotional banners with your own words, plus ready-made sign-offs.
- **Right-to-left:** a text-direction switch mirrors the whole signature for Arabic, Hebrew, Persian and Urdu. A check suggests it when your details are written in those scripts.
- **Accounts (Phase 2, optional):**
  - Sign in with an emailed link or Google to sync signatures, images, your saved details, brand kit and templates across devices.
  - Signed-in users host their images in their own account.
  - Short digital-card links (`/c/<slug>`) update with the signature.
  - Delete account is self-serve.
  - Needs a separate Signet Supabase project; setup is in [`supabase/README.md`](supabase/README.md). Without it, the app runs local-only and shows no sign-in.
- **Keyboard:** ↑/↓ select blocks, Enter edits (or steps into columns), Esc steps out, Alt+↑/↓ moves, ⌘D duplicates, Del deletes. Double-click a picture to crop it.
- **Animated GIFs** stay animated when sent as-is (no crop or rounding, up to 1 MB); a check explains when an edit would freeze one.
- **Routes:** `/` marketing site, `/app` dashboard, `/app/s/<id>` editor,
  `?card=…` digital card.

- **82 templates:**
  - 30 for business sectors (corporate, real estate, legal, finance, healthcare, tech, hospitality, beauty, fitness…).
  - 30 for personal style (Swiss, Bauhaus, Art Deco, Brutalist, neon, botanical, handwritten…).
  - 12 **Modern** designs: quiet luxury, gallery, noir & gold, architect, executive and more.
  - 10 **Modern Gentlemen** designs that follow the website: racing-red bands, Space Grotesk, Instrument Serif italics, IBM Plex Mono labels, square buttons.
  - Switch any time; content always comes along.
- **Details, images, social links, design** (12 palettes, colours, 20+ fonts with
  email-safe fallbacks, sizes, spacing, contact-label styles, dividers) and a
  separate **reply** version.
- **Add-ons:** handwritten sign-off, CTA button, Book a meeting, banner, video
  thumbnail, star rating, quote, app-store badges, disclaimer, green message.
- **Canva:** import a full signature design or a business card, trim, draw
  clickable areas, and send it pixel-exact — see [`docs/CANVA.md`](docs/CANVA.md).
- **Digital business card** page with flip animation, Save Contact (vCard), and a
  QR code in the signature.
- **Install flow** for Gmail, Outlook and Apple Mail: images are published to
  your image Worker, checked from the outside, then copied as rich HTML.
- Local-first: everything is saved in the browser; export/import backups in
  Settings.

## Develop

```bash
npm install
npm run dev          # app on http://localhost:5173
npm test             # unit tests (renderer, templates, slicing, digital card)
npm run e2e          # Playwright: builder DnD, brand kit, templates, Canva → Gmail copy, digital card
npm run build
npm run test:db      # Signet database schema + row-level security on a throwaway local Postgres
node scripts/make-icons.mjs   # only when the app icon changes: re-renders public/*.png
```

`npm run e2e` starts a test build (`VITE_TEST_HOST=1`) and a local image host
(`scripts/dev-host.mjs`); the test build is labelled in the UI.

## Deploy

Unchanged from 2.0: Cloudflare Pages (root `signature-studio`, build
`npm run build`, output `dist`, env `VITE_ASSET_HOST`) plus the image Worker in
[`worker/`](worker/README.md). The Worker's `ALLOWED_ORIGINS` must contain the
Pages address exactly.

## Layout

```
src/core/      document model, templates, fonts, social platforms, digital card
src/render/    the one renderer (preview + Gmail HTML), icons, validation
src/publish/   derive 2× images, host upload, verification, readiness
src/store/     editor state (undo/redo, autosave), uploaded assets
src/screens/   Landing, Home (dashboard), Editor, DigitalCard
src/builder/   drag-and-drop: Stage (canvas), dnd, palette, layers, inspector
src/core/blocks.ts  block tree operations + template → builder layouts
src/panels/    Templates, Details, Images, Social, Design, Add-ons, Canva
src/dialogs/   Install, Settings, Crop, Wizard, History, Banners
src/core/blockTemplates.ts  Modern + Modern Gentlemen templates (block recipes)
src/core/seasonal.ts        sign-offs and banner designs (SVG → PNG on use)
src/core/versions.ts        version history (stored in IndexedDB `ss3-versions`)
src/cloud/                  accounts + sync: CloudApi (Supabase / in-memory fake), sync plan + engine, account store
supabase/                   Signet's own database schema, RLS tests, setup guide
src/pwa.ts, public/         manifest, icons, service worker (production only)
docs/          PRODUCT.md, DECISIONS.md, CANVA.md
```
