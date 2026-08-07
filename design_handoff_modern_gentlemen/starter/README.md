# Modern Gentlemen — Starter Scaffold

A runnable Next.js (App Router) + React + TypeScript + Tailwind scaffold that implements the architecture in the parent handoff docs (`../README.md` and `../01`–`../05`). Most of it still renders from **demo data**, but that is no longer true everywhere: since Phase 7a the homepage reads its sections from Supabase, so `npm run build` needs a reachable, seeded project. See the root `CLAUDE.md` standing rules before building.

## What's here

- **Design system** wired: fonts (Space Grotesk / Instrument Serif / IBM Plex Mono / Futura), color tokens as CSS vars, light/dark with no-flash boot, 1320px content column. See `app/globals.css` + `tailwind.config.ts` (`../02`).
- **Chrome** — `components/chrome/Header.tsx` (frosted-on-scroll nav, theme toggle, live bag badge, top scrim) + `Footer.tsx` (always dark). The drawer / mega-menu / search / bag overlays are specified in `../04` — build them next.
- **Section builder** — the heart of the site (`../05`):
  - `components/sections/*` — one component per block + `registry.ts` (blockType → component).
  - `components/SectionRenderer.tsx` — renders a page's `sections[]`.
  - `lib/blocks/manifests/*` — one `defineBlock()` declaration per block: its fields, its Zod schemas and its insert defaults.
  - `components/admin/builder/*` — the in-app drag-and-drop canvas (dnd-kit) at `/admin/pages/[id]` and `/admin/articles/[id]/builder`, reusing the same section components and driving the same `sections[]`. One builder serves both: an article's block tree is one ordered list, exactly like a page's.
- **Media** — `/admin/media`: upload with checksum dedupe, alt text and focal point, and a usage record per placement. `components/admin/fields/MediaUrlControl.tsx` opens the library from any `image`/`video` field. An asset something is using cannot be deleted, and the refusal names where it is used.
- **Pages** — home (composable), `[category]`, `about`, `membership` (billing toggle + FAQ), `article/[slug]`, and the full store: `shop`, `product/[slug]`, `bag`, `checkout` (4-step, demo payment).
- **Commerce** — the catalogue is editable at `/admin/products`: prices in integer pence, variants, a gallery joined to the media library, and collections. Products are full documents, so they publish, version and roll back like pages. Since Phase 7b **the public store renders from the database** — `/shop` and `/product/[slug]` read `products` + `product_media` through `lib/services/publicCatalog.ts`, hydrated once per route by `lib/catalog/CatalogProvider.tsx`. The 16 products ported from `mg-catalog.js` now live at `lib/demo/catalog.ts` as the seed source and test fixture. `lib/cart/CartProvider.tsx` is unchanged in contract (localStorage cart behind a swappable `CartApi` — drop in Shopify later without touching UI); it just resolves slugs through the catalogue context instead of a module import.
- **CMS** — Supabase. `lib/db/*` clients, `lib/db/repositories/*`, `lib/services/*`. (The Sanity scaffold this file once described is gone; see PROGRESS.md.)

## Run it

```bash
cd starter
npm install
npm run dev        # http://localhost:3000  (needs .env.local — see below)
```

Most pages render immediately from demo data and bag/checkout work against the local cart. **The homepage does not** — it reads `pages` from Supabase and throws if nothing is published there, so a build without credentials fails on "No published page with slug home". That refusal is deliberate: a silent fallback to demo data would ship a plausible page from a broken read.

## Wire the real backends

1. **Supabase**: copy `.env.example` → `.env.local` and fill the Supabase URL and keys — **required**, since `middleware.ts` builds a client on every route. The schema lives in `supabase/migrations/`; `scripts/seed.ts` and `scripts/create-admin.ts` are both idempotent. **Run `npx tsx scripts/seed.ts` before the first build** — the homepage needs a published `home` page to render. Sign in at `/sign-in`, then work at `/admin/pages`, `/admin/articles`, `/admin/taxonomy`, `/admin/products` (with its collections screen) and `/admin/media`.
2. **Commerce**: keep the local cart for MVP, or implement an adapter satisfying `lib/cart/types.ts#CartApi` and swap the provider. See `../01_ARCHITECTURE.md §Commerce`.

> The Sanity scaffold this file originally described has been removed. Supabase
> is the data layer for everything — see `PROGRESS.md` at the repo root.

## Known gaps (intentional — build these next)

- Header overlays (drawer, mega-menu, search, bag drawer) are **now built** in `components/chrome/` and wired into `Header.tsx` via `useScrollLock`.
- 22 section blocks are built (`components/sections/`), each with a manifest in `lib/blocks/manifests/`; the remaining Section Library modules fold onto these by variant — see `../MODULE_MAP.md` for the full mapping and the few `TODO` archetypes (spec table, membership-tiers block, the 10 showcase heroes).
- Article template variants: only a placeholder hero — build one component per `template` enum value.
- Accessibility passes (focus traps, aria) — see `../01 §Accessibility`.
- `<img>` is used for simplicity; switch to `next/image` for production (remote patterns already configured in `next.config.mjs`).

## File tree

```
starter/
  app/
    (site)/       public routes (home, [category], about, membership, article, shop, product, bag, checkout, sign-in, preview)
    (admin)/      the admin shell · pages (+ builder, history) · articles (+ builder,
                  history) · taxonomy · media
  components/     chrome/ · sections/ · article/ · store/ · ui/ · admin/ · SectionRenderer
  lib/            blocks/ · domain/ · db/ (+ repositories/) · services/ · cart/ · catalog · theme
  supabase/       config.toml · migrations/
  public/images/  demo photography
```
