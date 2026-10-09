# Signet cloud (Phase 2) — Supabase setup

Accounts, cloud sync, image hosting and short card links run on a **separate
Supabase project just for Signet**. Never point any of this at the Modern
Gentlemen website's project (`qnfoztnyxhubnnulpfwt`) — the schema here is
unrelated to it.

Without the two `VITE_SUPABASE_*` variables the app stays local-only and shows
no sign-in at all.

## Live project

| | |
|---|---|
| Organisation | **Signet** (Free plan) |
| Project | `signet` — ref `wgrbgdvvhciahzhhhret`, region `ca-central-1` |
| API URL | `https://wgrbgdvvhciahzhhhret.supabase.co` |
| Schema | applied 2026-10-09 (all tables, policies, triggers, bucket); `delete_my_account()` pending — see below |

> **Applying through the Supabase MCP:** it asks for confirmation before any
> statement it considers destructive (`drop …`, and a function whose body
> contains `delete from`), and that confirmation can't reach a remote agent
> session, so the call simply times out. On an **empty** project, run the
> statements without the `drop … if exists` guards and use
> `create or replace trigger`; run anything containing `delete` in the
> dashboard's SQL editor.

## 1. Create the project

- Done (see above). For a fresh one: a Supabase organisation for Signet, then a
  project in it, region `ca-central-1`.

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

## 2b. Still to run by hand: `delete_my_account()`

Paste this in the dashboard → SQL editor → Run (the MCP can't run it, see above):

```sql
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

Until it exists, "Delete account" in the app shows an error and deletes nothing.

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
VITE_SUPABASE_URL       = https://wgrbgdvvhciahzhhhret.supabase.co
VITE_SUPABASE_ANON_KEY  = sb_publishable_…   (Project settings → API keys)
```

Redeploy. Signed-in users then host their images in their own folder, so the
shared Worker upload key is no longer needed for them.
