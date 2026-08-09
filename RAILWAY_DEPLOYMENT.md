# Deploying to Railway

Plain-English guide to hosting this site on [Railway](https://railway.com). The app is a standard Next.js server, which Railway runs natively — no Docker required.

**Key fact:** the app does **not** live at the repo root. It's in `design_handoff_modern_gentlemen/starter/`. You tell Railway that with the **Root Directory** setting (Step 3). Everything else is automatic.

For v1 there are **no required environment variables** — the site runs entirely on built-in data.

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
- **Build:** `npm ci && npm run build`
- **Start:** `npm run start`

Next.js `next start` automatically listens on the port Railway provides via the `PORT` environment variable, and binds to `0.0.0.0` — so nothing extra is needed. (If you ever run the start command manually, use `next start -p $PORT`.)

### 5. Deploy
- Railway builds on the first save and on **every push to the default branch** thereafter.
- Watch **Deployments → Logs**; when it's live, open the generated `*.up.railway.app` URL.
- **This project's is https://modern-gentlemen-website-production.up.railway.app** — worth knowing without opening the dashboard, since a deploy is now checkable with `curl -o /dev/null -w '%{http_code}' <url>`.

### 6. (Optional) Custom domain
- Service → **Settings → Networking → Custom Domain** → add your domain and follow the DNS (CNAME) instructions. Railway provisions HTTPS automatically.

---

## Environment variables

**Pixel-perfect UI on demo data needs none** — the scaffold runs with zero env vars, so you can deploy and iterate on the visual build immediately.

**The Supabase + Stripe data layer needs these** (add in Railway → service → **Variables**; full detail in `design_handoff_modern_gentlemen/06_SUPABASE.md`):

| Variable | For |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public (RLS-guarded) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — Stripe webhook / admin writes (never expose) |
| `STRIPE_SECRET_KEY` | Stripe API (server) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js (client) |
| `STRIPE_WEBHOOK_SECRET` | verify the Stripe webhook signature |

`starter/.env.example` lists them; **never commit real values.**

### Supabase & Stripe are separate services
- **Supabase** is its own managed project (or self-host it as a second Railway service via Railway's Supabase template). Railway hosts only the **Next.js app**; it connects to Supabase over the network using the vars above.
- **Stripe webhook:** after the app is live, register `https://<your-railway-domain>/api/webhooks/stripe` in the Stripe dashboard and put the resulting signing secret in `STRIPE_WEBHOOK_SECRET`.

---

## How redeploys work
Push to the default branch → Railway rebuilds and redeploys automatically. Roll back from **Deployments** (each build is retained). No manual steps.

---

## Config files in the repo (already added)
- **`design_handoff_modern_gentlemen/starter/railway.json`** — pins the build (`npm ci && npm run build`), start (`npm run start`), restart policy, and Nixpacks builder.
- **`design_handoff_modern_gentlemen/starter/nixpacks.toml`** — pins **Node 20** for the build.
- **`design_handoff_modern_gentlemen/starter/.env.example`** — the optional-backend variables (copy to `.env.local` for local dev only).

You do **not** need a Dockerfile — Railway's Nixpacks builder detects Next.js and uses the commands above.

---

## Troubleshooting
- **Build ignores the app / "no start command":** the **Root Directory** isn't set to `design_handoff_modern_gentlemen/starter` (Step 3).
- **App builds but the URL 502s:** ensure the start command is `npm run start` (not `next dev`) and you didn't hardcode a port — let Next read `PORT`.
- **Node version errors:** confirm `nixpacks.toml` pins Node 20 (Next 15 + React 19 need Node ≥18.18).
- **Type/lint errors fail the build:** `next build` runs type-checking. Fix reported errors, or (temporary) set `typescript.ignoreBuildErrors`/`eslint.ignoreDuringBuilds` in `next.config.mjs` — prefer fixing.
