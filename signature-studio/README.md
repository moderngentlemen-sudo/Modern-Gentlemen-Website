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

### Deploy (automatic)

`.github/workflows/signature-studio-deploy.yml` builds the app and deploys it to Cloudflare as **one Worker** that serves both the app and the signature images (`wrangler.toml`). The images are stored in R2. Because the app and the images share one address, no CORS configuration or separate image domain is needed.

One-time setup: add three repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Workers Scripts: Edit** and **Workers R2 Storage: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `SIGNATURE_UPLOAD_KEY` | A long random password |

R2 must be enabled once in the Cloudflare dashboard. After that, every push to `main` that touches `signature-studio/` deploys automatically, or you can trigger it from **Actions → Signature Studio deploy → Run workflow**. The run summary shows the live address.

In the app, open **Settings** once, paste the upload key, and leave the address empty.

### Image hosting

A signature that contains images can be installed only after those images are published to a public host:

* **Production:** deploy the Cloudflare Worker and R2 bucket in [`worker/`](worker/README.md). Then enter the host address and upload key in the app's **Settings** (gear icon). Set `VITE_ASSET_HOST` at build time to pre-fill the address. Never put the upload key in the build.
* **Local testing:** run `npm run dev:host`, which starts a test host on `http://localhost:8787` with upload key `dev-key`. Then start the app with `VITE_TEST_HOST=1 npm run dev`. A red **Test image host** badge in the status bar marks this mode. Images published to the test host are **not** visible to real recipients.

Text-only signatures need no hosting.

## Test

```sh
npm test               # unit tests (Vitest): model, renderer, validator, templates, history
npm run e2e            # end-to-end tests (Playwright): starts the app plus the test image host
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
worker/        Cloudflare Worker + R2 image host
scripts/       local test image host
tests/e2e/     Playwright specs
docs/          proposal, decisions, acceptance protocol, implementation report
```
