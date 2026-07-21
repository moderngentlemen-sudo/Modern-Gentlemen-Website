# 06 — Supabase (the single backend) + Stripe

> **Stack decision (supersedes the Sanity + Shopify recommendation in `01_ARCHITECTURE.md`/`CLAUDE.md`).**
> The project owner chose **Supabase for everything** — content, products, users/members, orders, newsletter, cart sync, and image storage — with **Stripe** for payments. This document is the authoritative data-layer spec.

Supabase is a **separate managed service** (Postgres + Auth + Storage + Edge). The Next.js app on **Railway** connects to it over the network. Stripe handles PCI-compliant payment capture; a Stripe webhook writes the resulting order into Supabase.

---

## What replaces what

| Concern | Old handoff | Now |
|---|---|---|
| Editorial content + section builder | Sanity (array-of-blocks) | **Supabase** `pages.sections` / `articles` / `categories` (Postgres **JSONB**) |
| Product catalog | hardcoded `lib/catalog.ts` / Shopify | **Supabase** `products` table (seeded from the same 16) |
| Cart | localStorage only | **localStorage for guests + Supabase `carts` for signed-in users** |
| Members / 15% discount | localStorage `mg-member` flag | **Supabase Auth + `profiles.is_member`** |
| Orders / checkout | demo `placeOrder()` | **Stripe payment → webhook writes Supabase `orders`** |
| Newsletter | no-op | **Supabase `newsletter_subscribers`** |
| Images | `public/images` placeholders | **Supabase Storage** (placeholders stay until real photography) |

The UI does **not** change: `<SectionRenderer/>` still consumes an ordered `Block[]`; the store still uses the `Product` shape and the `CartApi` seam. Only the **data source** behind them changes.

---

## Files added to the starter (scaffolding, ready to wire)
- `supabase/migrations/0001_init.sql` — all tables + Row Level Security policies + the `profiles` auto-create trigger.
- `supabase/seed.sql` — the 16 products (verbatim from `lib/catalog.ts`), the 5 categories, and the demo **home** page as an ordered `sections` array.
- `lib/supabase/client.ts` — browser client (Client Components).
- `lib/supabase/server.ts` — server client (Server Components / Route Handlers / Actions), cookie-based session via `@supabase/ssr`.
- `lib/supabase/admin.ts` — **service-role** client, server-only, bypasses RLS (Stripe webhook, admin writes).
- `lib/queries.ts` — `getPage / getCategory / getArticle / getProducts / getProduct`, returning the shapes components already consume.

> These compile as stubs. "Wiring up" = set the env vars, run the migration+seed against a Supabase project, then switch each page from its demo array to the matching `lib/queries.ts` call.

---

## Database schema (see `0001_init.sql` for the exact DDL)

**Money:** `numeric(10,2)` GBP pounds, matching `lib/catalog.ts` (price `145.00`, shipping `4.95`, member discount 15%). If you switch to integer pence, change the schema **and** the app money helpers together.

- **`profiles`** (1:1 `auth.users`) — `full_name`, `is_member`, `member_since`, `stripe_customer_id`, `role` (`user`/`admin`). A trigger creates a row on signup.
- **`products`** — the catalog: `slug`, `cat`, `cat_label`, `name`, `price`, `tag`, `material`, `blurb`, `story`, `specs` jsonb, `images` text[], `stock`, `position`, `published`.
- **Content:** **`pages`** (`slug`, `title`, `seo` jsonb, **`sections` jsonb** = `Block[]`), **`categories`** (`slug`, `name`, `intro`, `hero`, `sections`), **`articles`** (`slug`, `template`, `category`, `hero` jsonb, `body` jsonb, `published`).
- **`carts` / `cart_items`** — per-user cart (unique per `user_id`) for cross-device sync.
- **`orders` / `order_items`** — order id `MG-XXXXXX`, `status` (`pending→paid→fulfilled…`), money columns, `stripe_session_id`, `stripe_payment_intent`, `shipping_address` jsonb.
- **`newsletter_subscribers`** — unique `email`, `source`.

### Row Level Security (enabled on every table)
- **Public read** of `published` products / pages / categories / articles.
- **Users** read/write only their **own** `profiles` (cannot self-promote to admin), `carts`, and read their own `orders`.
- **Content + product writes are admin-only** via `is_admin()` (`profiles.role = 'admin'`).
- **Orders** are written **server-side with the service-role key** (webhook) — no client insert policy.
- **Newsletter** allows anonymous `insert` (email only); reads admin-only.

> Set your own admin: after signing up, run `update public.profiles set role='admin' where id='<your-uuid>';` in the SQL editor.

---

## Auth (Supabase Auth)
- Use **`@supabase/ssr`** with the three clients above. Email+password to start; add OAuth providers in the Supabase dashboard if wanted.
- Add **`middleware.ts`** at the app root to refresh the session cookie on each request (standard `@supabase/ssr` middleware) and to gate `/account` and admin routes.
- Member state = `profiles.is_member`. It drives the **15% member discount** across the store (replaces the localStorage `mg-member` flag; keep localStorage as a guest fallback only).
- Build a minimal **account** area (sign in / register / order history / membership status). This is new surface not in the prototype — keep it on-brand using the existing tokens/components.

## Cart sync
Add a **Supabase cart adapter** behind the existing `lib/cart/types.ts#CartApi`:
- **Guest** → the current localStorage adapter (unchanged).
- **Signed in** → read/write `carts`/`cart_items`; on login, **merge** the guest localStorage cart into the DB cart, then clear local.
- `isMember()` reads `profiles.is_member`; `memberRate` stays `0.15`.

## Payments — Stripe (see also `03_PAGES_AND_COMPONENTS.md §Checkout`)
Keep the 4-step checkout UI (Contact → Shipping → Payment → Review). At payment:
1. **`app/api/checkout/route.ts`** (server) creates a **Stripe Checkout Session** (recommended — hosted, PCI handled) or a PaymentIntent for Stripe Elements, from the server-recomputed cart total (never trust client totals). Attach the `MG-XXXXXX` order id + user/email in metadata; create a `pending` order row first.
2. Redirect to Stripe (or confirm the PaymentIntent in the Payment step).
3. **`app/api/webhooks/stripe/route.ts`** verifies the signature (`STRIPE_WEBHOOK_SECRET`), and on `checkout.session.completed` / `payment_intent.succeeded` uses the **service-role** client to mark the order `paid`, write `order_items`, and clear the user's cart. The **confirmation** screen reads the order from Supabase by id.
4. **Membership** purchase = a Stripe subscription (or one-time) whose webhook sets `profiles.is_member = true` + `member_since`.

> Recompute money on the server. The webhook is the source of truth for "paid", not the browser redirect.

## Storage (images)
- Create Storage buckets (e.g. `product-images`, `editorial`). Public-read for published assets; admin-write.
- Reference stored files by their public URL (or a signed URL for private ones). Add the Supabase storage host to `next.config.mjs` `images.remotePatterns` (already done — replace the placeholder host with your project's).
- Keep the 7 placeholders in `public/images` until real photography is uploaded (rights unconfirmed — see `HANDOFF_CHECKLIST.md`).

---

## Environment variables
Local: copy `starter/.env.example` → `.env.local`. Production: set the same in **Railway → Variables** (see `RAILWAY_DEPLOYMENT.md`).

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | public anon key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS — never expose to the browser |
| `STRIPE_SECRET_KEY` | server only | Stripe API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | server only | verify webhook signatures |

## Setup steps (for the build session)
1. Create a Supabase project (managed). Grab the URL + anon + service-role keys.
2. Install the Supabase CLI, `supabase link` the project, then `supabase db push` (applies `migrations/`) and load `seed.sql` — or paste both SQL files into the dashboard SQL editor. `supabase start` gives a full local stack for dev if preferred.
3. `npm i @supabase/supabase-js @supabase/ssr stripe @stripe/stripe-js` (and remove the Sanity deps — see `package.json` note).
4. Add `.env.local`; verify `getProducts()` returns the 16 rows; switch the store + homepage from demo data to `lib/queries.ts`.
5. Wire auth (`middleware.ts` + account UI), the cart adapter, then Stripe checkout + webhook.
6. Register the webhook URL in Stripe (`https://<your-railway-domain>/api/webhooks/stripe`).

## Self-hosting note
Supabase can be **self-hosted on Railway** (Railway has a Supabase template) if you want one bill/provider. Managed Supabase is simpler and recommended; the app config is identical either way — only the URL/keys differ.

## Scope flag
Replacing Sanity with Supabase JSONB means the **drag-and-drop section-builder admin is fully custom** (no Sanity Studio to lean on): an authenticated admin screen that edits `pages.sections` and saves the JSONB back. The `components/builder/SectionEditor.tsx` canvas already exists (dnd-kit) — point its load/save at Supabase. Budget for this; it's the largest net-new piece created by the "Supabase for everything" choice.
