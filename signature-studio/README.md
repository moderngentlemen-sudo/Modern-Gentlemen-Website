# Signet (working name) — Signature Studio

An email-signature product: a drag-and-drop builder, a Quick mode with simple
forms, Canva import, clickable business cards and a shareable digital card.
Signatures paste straight into Gmail. Product plan and name shortlist:
[`docs/PRODUCT.md`](docs/PRODUCT.md).

- **Drag-and-drop builder:** rows of columns of 25 kinds of block, layers,
  inspector, per-block style and panels, new-email/reply visibility, keyboard
  shortcuts, undo; works with touch. Every layout compiles to Gmail-safe tables.
- **Brand kit:** colours, fonts, logo, company — for new signatures and on demand.
- **Routes:** `/` marketing site, `/app` dashboard, `/app/s/<id>` editor,
  `?card=…` digital card.

- **60 templates**, half for business sectors (corporate, real estate, legal,
  finance, healthcare, tech, hospitality, beauty, fitness…) and half for
  personal style (Swiss, Bauhaus, Art Deco, Brutalist, neon, botanical,
  handwritten…), across 14 layouts. Switch any time; content always comes along.
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
src/dialogs/   Install, Settings, Crop
docs/          PRODUCT.md, DECISIONS.md, CANVA.md
```
