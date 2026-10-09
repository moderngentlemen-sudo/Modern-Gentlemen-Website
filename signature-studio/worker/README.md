# Signature Studio image host

A tiny Cloudflare Worker in front of an R2 bucket. It publishes email-ready signature images at permanent, public, content-addressed URLs.

## Why this design

* **It never pauses.** R2 and Workers have no inactivity pausing, so signatures already sent keep their images.
* **Immutable URLs.** `https://img.your-domain.com/s/<sha256>.png` never changes. Because the URL is served from your own domain, the storage behind it can be swapped later without breaking any signature.
* **No personal data in paths.** Object keys are hashes of the image bytes.
* **Hardened uploads:**
  * a bearer key is required;
  * only PNG, JPEG and GIF are accepted, checked by magic bytes;
  * uploads are limited to 1 MB;
  * the body must hash to its key;
  * nothing is ever overwritten.
* **No SSRF.** The Worker never fetches remote URLs.
* **Cheap.** R2 charges no egress fees, and a signature image is typically 5–40 KB.

## Deploy

```sh
cd worker
npm i -g wrangler
wrangler r2 bucket create signature-studio-images
wrangler secret put UPLOAD_KEY          # generate with: openssl rand -hex 32
# edit wrangler.toml: ALLOWED_ORIGINS and (recommended) a custom domain route
wrangler deploy
```

Then, in Signature Studio, open **Settings** (gear icon) and set:
* **Image host address**: `https://img.your-domain.com`
* **Upload key**: the `UPLOAD_KEY` you generated

Alternatively, set `VITE_ASSET_HOST` at build time so the address is pre-filled. Never put the upload key in a build variable.

## Backups

`GET /admin/backup.tar` with `Authorization: Bearer <UPLOAD_KEY>` downloads every stored image as one `.tar` archive. In the app, use **Settings → Download backup of published images**.

If you deployed through the dashboard before backups existed, update the code once: in **Workers & Pages → your Worker → Edit code**, replace it with the latest [`dashboard-worker.js`](dashboard-worker.js) and click **Deploy**. Your bindings and variables stay as they are.

## ALLOWED_ORIGINS must match the app's address exactly

Uploads and backups only work from addresses listed in `ALLOWED_ORIGINS`, comma-separated. Each entry needs `https://` and no trailing slash. Use the app's **permanent** address, such as `https://modern-gentlemen-website.pages.dev`. Per-deployment snapshot addresses like `https://aa8871b7.….pages.dev` change with every build, so don't list them.

## Before accounts exist

The upload key is a single shared secret for one workspace, such as Modern Gentlemen's own deployment. Once accounts exist (Phase 5), uploads will require a signed-in session token instead and the shared key will be retired.

## Deploy without a terminal (for example, from an iPad)

Everything above can also be done in the Cloudflare dashboard:

1. **R2 → Create bucket** named `signature-studio-images`.
2. **Workers & Pages → Create → Worker**, then **Edit code**. Replace the code with [`dashboard-worker.js`](dashboard-worker.js) and click **Deploy**.
3. In the Worker's **Settings → Bindings**, add an **R2 bucket** binding with variable name `IMAGES` and bucket `signature-studio-images`.
4. In **Settings → Variables and Secrets**, add:
   * `UPLOAD_KEY` as a **Secret**, set to a long random value;
   * `ALLOWED_ORIGINS` as **Text**, set to the app's address(es), comma-separated.
5. In **Settings → Domains & Routes**, add a custom domain such as `img.your-domain.com`.
