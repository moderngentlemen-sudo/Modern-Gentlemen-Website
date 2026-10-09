# Signet cloud (Phase 2) — Supabase setup

Accounts, cloud sync, image hosting and short card links run on a **separate
Supabase project just for Signet**. Never point any of this at the Modern
Gentlemen website's project (`qnfoztnyxhubnnulpfwt`) — the schema here is
unrelated to it.

Without the two `VITE_SUPABASE_*` variables the app stays local-only and shows
no sign-in at all.

## 1. Create the project

- Create a Supabase organisation for Signet (free plan is fine to start), then
  a project in it — e.g. `signet`, region `ca-central-1`.

## 2. Apply the schema

Apply `migrations/20261009000001_signet_schema.sql` (SQL editor, the Supabase
CLI, or the Supabase MCP `apply_migration`). It is re-runnable. It creates:

| Object | What it holds | Who can read / write |
|---|---|---|
| `profiles` | name, plan, synced preferences (saved profile, brand kit, my templates, favourites) | owner only; `plan` is not user-writable |
| `signatures` | each signature as JSON, with `revision` (optimistic concurrency) and soft-delete | owner only |
| `cards` | digital cards behind `/c/<slug>` | anyone reads `slug` + `data`; owner writes |
| bucket `signet-images` | published images (`<uid>/s/…`) and synced originals (`<uid>/o/…`) | public read; upload/delete only in your own folder; PNG/JPEG/GIF ≤ 5 MB |
| `delete_my_account()` | removes the login and everything that cascades from it | the signed-in user, for themselves |

Test it locally any time: `npm run test:db` (applies it twice on a throwaway
Postgres, then runs `tests/rls.sql`).

## 3. Auth settings (dashboard → Authentication)

- **URL configuration**
  - Site URL: `https://modern-gentlemen-website.pages.dev` (or the product's own domain later).
  - Redirect URLs: add `https://modern-gentlemen-website.pages.dev/app` and, for development, `http://localhost:5173/app`.
- **Email (magic link)** is on by default. The built-in mailer is rate-limited
  (a few emails an hour); set up custom SMTP before a public launch.
- **Google sign-in** (optional): create an OAuth client in Google Cloud
  (type "Web application"), add Supabase's callback URL shown on the Google
  provider page as an authorised redirect URI, and paste the client ID and
  secret into the Google provider. This only signs people in — it is *not*
  the Gmail-settings permission, which needs Google's verification (see
  `docs/PRODUCT.md`).

## 4. Point the app at it

Cloudflare Pages → the Signet project → Settings → Environment variables:

```
VITE_SUPABASE_URL       = https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY  = sb_publishable_…   (Project settings → API keys)
```

Redeploy. Signed-in users then host their images in their own folder, so the
shared Worker upload key is no longer needed for them.
