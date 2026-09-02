# Handoff Checklist — pre-flight for Claude Code

A pre-flight list for picking this up in a real build. Nothing here blocks starting — `cd starter && npm install && npm run dev` runs today on demo data. Work top to bottom.

## 0. Start

- [ ] `cd starter && npm install && npm run dev` → confirm http://localhost:3000 renders on demo data.
- [ ] Skim `README.md` → `01`–`05` + `MODULE_MAP.md`. `starter/README.md` explains the code layout.

## 1. Decisions to make (owner input)

- [ ] **Commerce backend** — Shopify headless (recommended) vs. Stripe Checkout vs. local-only MVP. See `01_ARCHITECTURE.md §Commerce`. The `CartProvider` seam supports any; only the adapter changes.
- [ ] **CMS project** — create a Sanity project; decide dataset name(s) (`production`, `staging`).
- [ ] **Article templates** — which of the ~20 hero/body variants are actually in use (drives how many to build).
- [ ] **Membership** — real subscriptions (Shopify/Stripe Billing) vs. flag-only for launch.

## 2. Accounts & secrets (copy `starter/.env.example` → `.env.local`)

- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`
- [ ] Shopify: `NEXT_PUBLIC_SHOPIFY_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN` — **or** Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Newsletter ESP key (Klaviyo/Mailchimp) for the Newsletter block POST.

## 3. Content & assets

- [ ] Replace the 7 placeholder photos in `starter/public/images/` (confirm rights) — production imagery flows through the CMS/Shopify.
- [ ] Author real copy: homepage sections, category intros, articles, product story/specs.
- [ ] Switch `<img>` → `next/image` (remote patterns already set in `next.config.mjs`).

## 4. Wire the backends

- [ ] Uncomment `sanityFetch` calls in `app/page.tsx`, `app/[category]/page.tsx`, `app/about/page.tsx`, `app/article/[slug]/page.tsx`; delete the demo arrays.
- [ ] Implement the chosen commerce adapter behind `lib/cart/types.ts#CartApi`; swap it into `CartProvider`.
- [ ] Point the catalog at Shopify (or keep `lib/catalog.ts` for MVP).

## 5. Build the stubbed pieces (all documented as TODO)

- [ ] Article template hero/body variants — one component per `template` enum value.
- [ ] Remaining Section Library modules — all 145 are inventoried in `MODULE_MAP.md`; Hero Studio now supplies native presets 001 and 069–071. Continue the queued families without removing the compatible existing blocks.
- [ ] Checkout payment step — replace demo with Stripe Elements or redirect to hosted checkout.
- [ ] Member accounts/auth (if in scope).

## 6. Quality pass before launch

- [ ] **Accessibility** — focus traps in overlays, `aria-expanded` on menu triggers, visible focus rings, `prefers-reduced-motion` gating, alt text on all images (`01 §Accessibility`).
- [ ] SEO — metadata per route, `Product` JSON-LD on PDPs, sitemap + robots.
- [ ] Responsive QA on the hero, grids, and store pages.
- [ ] Lighthouse / Core Web Vitals; image sizing; font loading.
- [ ] Verify theme (light default) boots with no flash; footer stays dark in both themes.

## Reference: what's already built in `starter/`

Design system + tokens · chrome (header, frosted nav, mega-menu, drawer, search, bag drawer, footer, theme toggle) · 13 section blocks + registry + `SectionRenderer` + in-app drag-and-drop `SectionEditor` · all pages (home, category, about, membership, article, store/product/bag/checkout) · 16-product catalog + local cart behind the swappable `CartApi` · Sanity schemas (page/category/article/product + block types) + client/queries.
