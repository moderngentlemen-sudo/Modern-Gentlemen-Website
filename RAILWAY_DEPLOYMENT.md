# Deploying to Railway

Plain-English guide to hosting this site on [Railway](https://railway.com). The app is a standard Next.js server, which Railway runs natively — no Docker required.

**Key fact:** the app does **not** live at the repo root. It's in `design_handoff_modern_gentlemen/starter/`. You tell Railway that with the **Root Directory** setting (Step 3). Everything else is automatic.

The public site reads published content during `next build`, so a deployment
requires a reachable, migrated and seeded Supabase project. Railway runs an
executable preflight before the build and names missing or malformed variables
without printing their values.

---

## One-time setup

### 1. Create the project

- Log in to Railway → **New Project** → **Deploy from GitHub repo**.
- Authorize Railway for the `moderngentlemen-sudo` account and pick the **Modern-Gentlemen** repo.

### 2. It will create a service

Railway adds a service and tries to build from the repo root. That will fail or do nothing useful until you set the root directory — that's expected. Fix it in Step 3.

### 3. Point Railway at the app folder ⚠️ (the important one)

- Open the service → **Settings** → **Source / Build**.
- Set **Root Directory** to:
  ```
  design_handoff_modern_gentlemen/starter
  ```
- This makes Railway install, build, and run from the Next.js app folder.

### 4. Build & start commands

A `railway.json` in the app folder already pins these, so Railway uses them automatically:

- **Build:** `npm run deploy:check && npm run build`
- **Start:** `npm run start`

Next.js `next start` automatically listens on the port Railway provides via the `PORT` environment variable, and binds to `0.0.0.0` — so nothing extra is needed. (If you ever run the start command manually, use `next start -p $PORT`.)

### 5. Deploy

- Railway builds on the first save and on **every push to the default branch** thereafter.
- A Railway deploy does **not** apply Supabase migrations. Before deploying code
  that depends on a new migration, apply every pending file in
  `design_handoff_modern_gentlemen/starter/supabase/migrations/` to the same
  Supabase project configured in Railway.
- Watch **Deployments → Logs**; when it's live, open the generated `*.up.railway.app` URL.
- **This project's is https://modern-gentlemen-website-production.up.railway.app** — worth knowing without opening the dashboard, since a deploy is now checkable with `curl -o /dev/null -w '%{http_code}' <url>`.

### 6. (Optional) Custom domain

- Service → **Settings → Networking → Custom Domain** → add your domain and follow the DNS (CNAME) instructions. Railway provisions HTTPS automatically.

---

## Environment variables

Add these in Railway → service → **Variables**; full detail is in
`design_handoff_modern_gentlemen/06_SUPABASE.md`:

| Variable                            | Required | For                                                            |
| ----------------------------------- | -------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`              | Yes      | HTTPS public origin for redirects, canonicals and metadata     |
| `NEXT_PUBLIC_SUPABASE_URL`          | Yes      | Supabase project origin                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Yes      | Supabase public, RLS-guarded key                               |
| `SUPABASE_SERVICE_ROLE_KEY`         | Yes      | **Server only**; provisioning and privileged background work   |
| `JOBS_SECRET`                       | Yes      | Bearer secret for scheduled publish/import routes              |
| `RATE_LIMIT_SALT`                   | Advised  | Makes public rate-limit identity hashes impractical to reverse |
| `FEED_<MERCHANT>_TOKEN`             | Per feed | Credential named by an authenticated product source row        |
| `STRIPE_*` / `NEXT_PUBLIC_STRIPE_*` | Not yet  | Reserved; setting them does not enable the demo checkout       |

`starter/.env.example` lists them; **never commit real values.**

### Supabase and payments are separate services

- **Supabase** is its own managed project. Railway hosts the Next.js app and
  connects to Supabase over the network using the variables above.
- **Payments are intentionally not live.** Checkout clearly remains a demo; no
  Stripe endpoint or webhook route exists yet. Do not register a webhook or
  assume that adding the reserved Stripe variables charges a customer. The
  owner must first decide fulfillment, shipping/tax behavior, membership billing
  and the final Checkout/Elements flow.

---

## How redeploys work

Push to the default branch → Railway rebuilds and redeploys automatically. Roll back from **Deployments** (each build is retained). No manual steps.

---

## Config files in the repo (already added)

- **`design_handoff_modern_gentlemen/starter/railway.json`** — pins the build (`npm ci && npm run build`), start (`npm run start`), restart policy, and Nixpacks builder.
- **`design_handoff_modern_gentlemen/starter/nixpacks.toml`** — pins **Node 22** for the build.
- **`design_handoff_modern_gentlemen/starter/.env.example`** — the optional-backend variables (copy to `.env.local` for local dev only).

You do **not** need a Dockerfile — Railway's Nixpacks builder detects Next.js and uses the commands above.

---

## Troubleshooting

- **Build ignores the app / "no start command":** the **Root Directory** isn't set to `design_handoff_modern_gentlemen/starter` (Step 3).
- **App builds but the URL 502s:** ensure the start command is `npm run start` (not `next dev`) and you didn't hardcode a port — let Next read `PORT`.
- **Preflight reports missing variables:** add the named values in Railway; it
  never prints secret contents. `NEXT_PUBLIC_SITE_URL` must be the HTTPS origin
  only, without a path or trailing subdirectory.
- **Build says no published `home` page exists:** apply all migrations and run
  the idempotent seed script against the intended Supabase project.
- **Article search throws a server-side exception:** verify migration
  `0030_article_search.sql` is applied. The application includes a temporary
  compatibility fallback for a database that trails this migration, but the
  migration is still required for indexed search performance.
- **Node version errors:** confirm `nixpacks.toml` pins Node 22, matching
  `package.json` and `.nvmrc`.
- **Type/lint errors fail the build:** `next build` runs type-checking. Fix reported errors, or (temporary) set `typescript.ignoreBuildErrors`/`eslint.ignoreDuringBuilds` in `next.config.mjs` — prefer fixing.
