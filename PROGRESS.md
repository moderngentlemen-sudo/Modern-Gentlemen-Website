# Build Progress Tracker

Update this as you build. Mark items `[x]` done, `[~]` in progress, `[!]` blocked. Add a note for any deviation from the design and why. This doubles as the **post-build verification report** required by `IMPLEMENTATION_BRIEF.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & screenshot-verified · `[!]` blocked/needs decision

---

## Phase 0 — Smoke test & deploy pipeline
- [x] `npm install` + `npm run dev` renders the scaffold locally (HTTP 200, full nav chrome + sections render on demo data); `npm run build` (Railway's command) also passes clean; `package-lock.json` generated & committed
- [ ] Railway project created, Root Directory = `design_handoff_modern_gentlemen/starter` — needs the owner's Railway account
- [ ] Scaffold deployed live on a Railway URL — needs the owner's Railway account
- [ ] Auto-redeploy on push confirmed — after first deploy

## Phase 1 — Foundation
- [x] Fonts wired (Space Grotesk / Instrument Serif / IBM Plex Mono / Futura stack)
- [x] Color tokens + `[data-darkband]` verified in light AND dark (darkband now pins the full dark token set)
- [x] 1320px content container correct
- [x] No-flash light-default theme boot (inline script before paint)

## Phase 2 — Chrome  (ref: `04_CHROME.md`)
- [x] Header + 85px top scrim (frost on scroll, animated red underline) — `homepage-desktop.png`
- [x] Mega-menu (STYLE/GROOMING/WATCHES/CULTURE) — `02-nav-megamenu.png`
- [x] Slide-over drawer (accordion, member CTA, socials) — `drawer-open.png`
- [x] Search overlay (popular chips + EDITORIAL/STORE groups) — `01–02-search-overlay.png`
- [x] Bag drawer (empty + populated) — `bag-drawer.png`
- [x] Footer (always dark) — `footer.png`
- [x] Overlay scroll-lock / focus-trap / Esc (all overlays)
- [x] Theme toggle persists + no flash

## Phase 3 — Section blocks  (ref: `05_SECTION_BUILDER.md`, `MODULE_MAP.md`)
- [~] 13 scaffolded blocks brought to fidelity (as pages need them) — homepage's 7 done to fidelity (heroCoverStar, latestGrid `sixUp`, featureSplit `fullBleed`, twoUpCategory, storyBand, filmStills, newsletter); the other 6 as their pages are built
- [ ] TODO archetypes built when needed: `specTable`, `membershipTiers`, `heroVogue01…10`

## Phase 4 — Editorial pages
- [x] Homepage — `homepage-desktop.png` + `01–04-homepage.png` (7 sections, verbatim copy; screenshot-verified at 1440/909/375 + dark)
- [ ] Category ×5 (Style/Grooming/Watches/Culture/Film) — `01–02-category-desktop.png`
- [ ] About — `01–02-about-desktop.png`
- [ ] Membership (billing toggle, 3 tiers, FAQ) — `01–03-membership-desktop.png`
- [ ] Article (templates used in refs first) — `01–02-article-desktop.png`

## Phase 5 — Store
- [x] Store grid (filter chips, ADD→ADDED ✓, cart note) — `01–02-store-desktop.png` (hero + ?cat= sync + members band; screenshot-verified)
- [x] Product / PDP (sticky gallery, story, specs, related) — `01–03-product-desktop.png` (+ styled not-found matching `01-product-desktop.png`; per-slug state reset; assurances)
- [x] Bag page (line items + sticky summary, empty state) — `bag-desktop.png` (member-discount math + free-ship verified)
- [x] Checkout (4 steps + validation + confirmation) — `checkout-desktop.png` (step indicator, per-step validation, empty-bag guard, confirmation)

## Phase 6 — Section Library + builder
- [ ] Section Library picker page — `section-library.png`
- [ ] Drag-and-drop builder wired to the block registry

## Phase 7 — Quality pass
- [ ] Responsive QA at 1024 / 900 / 680 / 375 (own mobile captures)
- [ ] Accessibility: focus traps, `aria-expanded`, visible focus rings, reduced-motion, alt text
- [ ] SEO: per-route metadata, Product JSON-LD on PDPs, sitemap + robots
- [ ] Dark-mode sweep on every page (footer stays dark)
- [ ] Lighthouse / Core Web Vitals; image sizing; font loading
- [ ] Production imagery/video rights confirmed OR flagged (current media are placeholders)

---

## Deviations & decisions log
_Record anything you could not reproduce exactly, ambiguities, or choices made (e.g. which article templates were built, SHOP vs STORE route naming). One line each._

- Phase 0 setup: generated & committed `starter/package-lock.json` (was missing) so Railway's `npm ci` build succeeds.
- Fixed a strict-mode TypeScript error in `starter/lib/supabase/server.ts` — annotated the `setAll(cookiesToSet)` param (implicit `any` was blocking `next build`); no behavior change.
- Added `next-env.d.ts` + `*.tsbuildinfo` to `starter/.gitignore` (Next.js convention; auto-generated on build).
- Milestone 1 (homepage + chrome): header is **frost-only, no shrink-on-scroll** (EXECUTION_PLAN §10 overrides the prototype's `shrinkOnScroll` canon); header height 72px stable and treated as always-dark chrome; nav collapses to burger ≤820px (not `lg`/1024).
- `[data-darkband]` now pins the full dark token set (`--mg-bg/--mg-surface/--mg-accent-serif`) so shared token-driven components (e.g. `Button`) render correctly on dark bands.
- Hero renders the cover **image** (`hero-cover.jpg`) — no licensed video asset yet; imperative muted autoplay + IntersectionObserver is wired for when a `videoUrl` is supplied.
- Footer socials use text letter-marks (I / X / Y / in) pending real brand icon SVGs.
- Milestone 2 (store flow): shared commerce primitives added in `components/store/` (`ProductCard`, `QtyStepper`, `OrderSummary`, `Field`/`SelectField`) and reused across the 4 pages.
- `formatGBP` de-duplicated — `CartProvider` re-exports catalog's, so shipping now formats as **£4.95** (was rounding to £5).
- Shop filter is synced to the URL `?cat=` via a Suspense-wrapped `useSearchParams`.
- PDP not-found is a **styled client fallback** (pixel-matches the reference PNG) rather than server `notFound()`, since the page stays client for `useCart`; real-404 status deferred to SEO/Track B.
- Checkout payment is **demo-only** (no card charged); real Stripe checkout + the `cart.checkoutUrl()` seam is Track B.

## Track B — Data layer: Supabase + Stripe (see `EXECUTION_PLAN.md §9`, `06_SUPABASE.md`)
- [ ] Supabase project provisioned; `0001_init.sql` + `seed.sql` applied; `getProducts()` returns 16
- [ ] Env vars set (Supabase URL/anon/service-role + Stripe secret/publishable/webhook) locally + Railway
- [ ] Content/products switched from demo arrays to `lib/queries.ts`
- [ ] Auth (`@supabase/ssr` + `middleware.ts` + account area); `is_member` drives 15% discount
- [ ] Supabase cart adapter behind `CartApi` (guest localStorage → merge on login)
- [ ] Stripe checkout route + webhook writing `orders`/`order_items`; confirmation reads from Supabase
- [ ] Membership = Stripe subscription → webhook sets `is_member`
- [ ] Supabase Storage buckets + `next.config.mjs` remote host; real imagery uploaded
- [ ] Section-builder admin loads/saves `pages.sections` JSONB (auth-gated) — net-new scope
- [ ] Legacy Sanity scaffold removed (`sanity/`, `lib/sanity/`, `sanity.config.ts`, `@sanity/*` deps)

## Still deferred
- [ ] Real membership subscriptions vs. flag-only
- [ ] Newsletter ESP integration (Supabase capture works standalone)
- [ ] Production imagery/video + rights
- [ ] Remaining article templates & Section Library modules
