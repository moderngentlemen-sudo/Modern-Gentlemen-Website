# Modern Gentlemen — Starter Scaffold

A runnable Next.js (App Router) + React + TypeScript + Tailwind scaffold that implements the architecture in the parent handoff docs (`../README.md` and `../01`–`../05`). It boots with **demo data** so you can see it working before wiring Sanity or a commerce backend.

## What's here

- **Design system** wired: fonts (Space Grotesk / Instrument Serif / IBM Plex Mono / Futura), color tokens as CSS vars, light/dark with no-flash boot, 1320px content column. See `app/globals.css` + `tailwind.config.ts` (`../02`).
- **Chrome** — `components/chrome/Header.tsx` (frosted-on-scroll nav, theme toggle, live bag badge, top scrim) + `Footer.tsx` (always dark). The drawer / mega-menu / search / bag overlays are specified in `../04` — build them next.
- **Section builder** — the heart of the site (`../05`):
  - `components/sections/*` — one component per block + `registry.ts` (blockType → component).
  - `components/SectionRenderer.tsx` — renders a page's `sections[]`.
  - `components/builder/SectionEditor.tsx` — optional in-app drag-and-drop canvas (dnd-kit), reusing the same components.
  - `sanity/schemas/*` — the CMS side: `page`/`category` docs carry a drag-and-drop `sections[]`; one schema per block. This gives editors drag-and-drop for free (Level A).
- **Pages** — home (composable), `[category]`, `about`, `membership` (billing toggle + FAQ), `article/[slug]`, and the full store: `shop`, `product/[slug]`, `bag`, `checkout` (4-step, demo payment).
- **Commerce** — `lib/catalog.ts` (all 16 products ported from `mg-catalog.js`) + `lib/cart/CartProvider.tsx` (localStorage cart behind a swappable `CartApi` interface — drop in Shopify later without touching UI).
- **CMS** — `lib/sanity/*` client + GROQ queries + `sanity.config.ts` studio.

## Run it

```bash
cd starter
npm install
npm run dev        # http://localhost:3000  (runs on demo data, no CMS needed)
```

Pages render immediately from demo data. Bag/checkout work against the local cart.

## Wire the real backends

1. **Sanity**: copy `.env.example` → `.env.local`, fill `NEXT_PUBLIC_SANITY_PROJECT_ID`. Run the studio (`npm run sanity` or mount `sanity.config.ts` at `/studio`). Then uncomment the `sanityFetch` calls in `app/page.tsx`, `app/[category]/page.tsx`, `app/about/page.tsx`, `app/article/[slug]/page.tsx`.
2. **Commerce**: keep the local cart for MVP, or implement a Shopify adapter satisfying `lib/cart/types.ts#CartApi` and swap the provider. See `../01_ARCHITECTURE.md §Commerce`.

## Known gaps (intentional — build these next)

- Header overlays (drawer, mega-menu, search, bag drawer) are **now built** in `components/chrome/` and wired into `Header.tsx` via `useScrollLock`.
- 13 section blocks are built (`components/sections/`); the remaining Section Library modules fold onto these by variant — see `../MODULE_MAP.md` for the full mapping and the few `TODO` archetypes (spec table, membership-tiers block, the 10 showcase heroes).
- Article template variants: only a placeholder hero — build one component per `template` enum value.
- Accessibility passes (focus traps, aria) — see `../01 §Accessibility`.
- `<img>` is used for simplicity; switch to `next/image` for production (remote patterns already configured in `next.config.mjs`).

## File tree

```
starter/
  app/            routes (layout, home, [category], about, membership, article, shop, product, bag, checkout, admin/builder)
  components/     chrome/ · sections/ · builder/ · ui/ · SectionRenderer
  lib/            catalog · cart/ · theme · sanity/
  sanity/         schemas (documents/ · blocks/ · objects/)
  public/images/  demo photography
```
