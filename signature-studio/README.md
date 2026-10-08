# Signature Studio 2.0

A premium email-signature design studio with **Gmail installation that actually works**. You design once and get a Full signature and a Reply signature. Every image is published to a verified public URL before you are allowed to copy.

* **Simple and Advanced modes** on one document: a guided four-step flow, or full design control. Advanced mode adds the layers panel, inspector, drag and drop, resize handles, snapping, undo and redo, and keyboard shortcuts.
* **40 templates** across 19 categories. Switching layouts keeps your profile, social links, images and custom components.
* **One profile, connected everywhere.** Editing your title once updates every component that shows it. A component can be detached when it needs independent text.
* **Full and Reply visibility** per component (Both / Full / Reply / Hidden), with a side-by-side compare view and a one-click "Make Reply compact" option.
* **The canvas shows the real email HTML.** The editor renders the same table-based markup that gets copied into Gmail, so what you see is what recipients get. An "As recipients see it" mode shows the fallback fonts.
* **Images you can trust:**
  * crop, shape, radius and tint are baked into a 2× PNG;
  * each image is stored at a content-addressed, immutable URL;
  * each URL is fetched back anonymously and decoded before the signature counts as ready.
* **Local-first.** Projects, images, saved components, brand kits and named versions are stored in your browser, and no account is needed. Projects can be exported and imported as files.

See [`docs/PROPOSAL.md`](docs/PROPOSAL.md) for the product, UX and architecture proposal, [`docs/DECISIONS.md`](docs/DECISIONS.md) for the decision register, and [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md) for what has been built and tested.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173
```

### Deploy (Railway)

Signature Studio runs as **one small Node server** (`server/index.mjs`, no dependencies). The server serves the app and also stores and serves the signature images. Images live on a Railway **volume**, a persistent disk. Because the app and its images share one address, no separate image host or CORS setup is needed.

`railway.json` and `nixpacks.toml` hold the build and start configuration, the same pattern as the website in `design_handoff_modern_gentlemen/starter/`. To set it up in Railway:

1. **New → GitHub Repo → Modern-Gentlemen-Website.** This creates a second service next to the website.
2. In the service's **Settings**, set **Root Directory** to `signature-studio`.
3. Right-click the service (or use **⋯**) → **Attach volume**. Any mount path works: the server finds it through `RAILWAY_VOLUME_MOUNT_PATH`.
4. In **Variables**, add `UPLOAD_KEY`, set to a long random password.
5. In **Settings → Networking**, click **Generate Domain**. Optionally add a custom domain such as `signatures.moderngentlemen.co`.

Railway redeploys automatically whenever `main` changes. In the app, open **Settings** once, paste the upload key, and leave the address empty.

Two optional variables:
* **`PUBLIC_URL`** fixes the address written into image links, for example `https://signatures.moderngentlemen.co`. Set it once you have a custom domain, so links don't depend on the Railway address.
* **`DATA_DIR`** overrides where images are stored.

**Backups:** in the app, **Settings → Download backup of published images** saves every published image as one `.tar` file.

**Important:** don't delete the volume or the domain. Signatures that have already been sent point at them.

### Image hosting

A signature that contains images can be installed only after those images are published:

* **Production:** handled by the Railway server above.
* **Local testing:** run `npm run dev:host`. It starts the same server on `http://localhost:8787` with upload key `dev-key`. Then start the app with `VITE_TEST_HOST=1 npm run dev`, and in **Settings** enter `http://localhost:8787` and `dev-key`. A red **Test image host** badge in the status bar marks this mode. Images on a local host are **not** visible to real recipients.

Text-only signatures need no hosting.

## Test

```sh
npm test               # unit tests (Vitest): model, renderer, validator, templates, history, server
npm run e2e            # end-to-end tests (Playwright): starts the app plus the image server
npm run typecheck
npm run build
```

## Project layout

```
src/
  model/       document schema, tree operations, profile, fonts, social platforms, presets, migration
  render/      renderSignature (edit / preview / email), email-HTML validator, icons and QR codes
  publish/     derive → hash → publish → verify pipeline, host adapter
  templates/   template library, safe template application, starter projects
  state/       editor store (undo/redo), projects and autosave, assets, preferences
  storage/     IndexedDB repositories
  editor/      canvas, inspector, panels, dialogs, drag and drop, shortcuts, design assistance
  ui/          shared controls
server/        Node server: serves the app and hosts signature images (Railway)
tests/e2e/     Playwright specs
docs/          proposal, decisions, acceptance protocol, implementation report
```
