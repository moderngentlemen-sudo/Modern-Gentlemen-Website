# Build Progress Tracker

Update this as you build. Mark items `[x]` done, `[~]` in progress, `[!]` blocked. Add a note for any deviation from the design and why. This doubles as the **post-build verification report** required by `IMPLEMENTATION_BRIEF.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & verified · `[!]` blocked/needs decision

---

## 📍 Current Status & Session Handoff — READ FIRST

**Branch:** `claude/modern-gentlemen-admin-ntslwo` (all backend work). **Deploy:** Railway, Root Directory `design_handoff_modern_gentlemen/starter`. **Database:** Supabase project `qnfoztnyxhubnnulpfwt` — schema applied and seeded, **live**.

Two tracks now exist. **Track A (front-end)** is complete and pixel-verified. **Track B (backend + admin platform)** is in progress: the data foundation and auth are done, the builder and CMS are not.

Live state (branch, commits, migrations, test counts) is printed automatically at session start by a hook. Run it any time:
`node design_handoff_modern_gentlemen/starter/scripts/status.mjs`

### Progress snapshot

| Track | Phase | Scope | Status |
|---|---|---|---|
| A | Milestones 0–4 | Setup/deploy, chrome, homepage, store flow, editorial pages, 20-template article system | ✅ done, screenshot-verified |
| A | Phase 6–7 | Section Library builder, global SEO/a11y/Lighthouse pass | ⬜ not started (superseded in part by Track B Phase 4) |
| B | Phase 0 — Toolchain | ESLint/Prettier, Vitest, Playwright, CI, layering rules, Sanity removed | ✅ done |
| B | Phase 1 — Data foundation | 9 migrations applied (41 tables, 88 RLS policies), RBAC, typed clients, seed | ✅ done |
| B | Phase 1c — Auth | admin account, `middleware.ts`, sign-in, gated `/admin`, auth service | ✅ done |
| B | Phase 2 — Block manifests | `defineBlock`, 22 manifests, binding engine, resolver, conformance suite | ⬜ **next** |
| B | Phase 3 — Documents & publishing | templates, patterns, revisions, rollback, preview | ⬜ not started |
| B | Phase 4 — Admin UI & builder | `components/admin/ui/*`, shell, builder canvas, properties panel | ⬜ not started |
| B | Phase 5 — CMS & media | article/taxonomy editors, media library with usage tracking | ⬜ not started |
| B | Phase 6 — Commerce & integrations | products, XML ingestion, Shopify adapter, navigation, theme editor | ⬜ not started |
| B | Phase 7 — Rewire & harden | public site reads the DB; full E2E + visual regression | ⬜ not started |

### ⚠️ Corrections to earlier guidance in this file

Instructions below that were true during Track A and are **now wrong**. A session acting on the old version will undo correct work.

- **"Cart + catalog are FINISHED — do not rebuild"** — no longer accurate. `lib/cart/CartProvider.tsx` now delegates its money maths to `lib/domain/pricing.ts`. This fixed a real bug: the original ran `Math.round()` over a **pounds** value, discounting a £145 subtotal by £22.00 instead of £21.75 — overcharging members 25p and able to flip the £50 free-shipping threshold. Do not revert it. The **rules** (15%, ≥£50, qty-0-removes) are unchanged and still correct.
- **Money is integer pence**, not pounds. `lib/domain/money.ts` converts at the boundary. The DB stores `price_pence integer`.
- **`lib/queries.ts` and `lib/supabase/` no longer exist.** Use `lib/db/{client,server,admin}.ts`. Repositories replace `queries.ts` in Phase 2.
- **`supabase/migrations/0001_init.sql` no longer exists.** It was never applied and is superseded by `0001`–`0009`.
- **The Sanity scaffold is gone** (`sanity/`, `lib/sanity/`, `sanity.config.ts`, `@sanity/*`, `styled-components`). Do not reference it.
- **Stripe is out of scope** for now, by decision. Checkout stays demo-only. The commerce layer manages catalog/inventory/merchandising, not payments.
- **The app is no longer "100% demo data with no env vars."** It needs `.env.local` (see below) and reads a live Supabase project.

### What runs today

Public site: unchanged and still rendering from demo modules (`lib/demo/home-sections.ts`, `lib/catalog.ts`, `lib/editorial.ts`, `lib/articles.ts`). Phase 7 switches it to the database.

New in Track B: **`/sign-in`** and a gated **`/admin`** showing the signed-in identity and resolved permission set. `middleware.ts` refreshes the session and redirects unauthenticated `/admin` traffic.

Admin account: `welcome@moderngentlemen.co`, role `admin` (40 permissions). Created by `scripts/create-admin.ts` — idempotent, safe to re-run.

### Environment

`design_handoff_modern_gentlemen/starter/.env.local` (gitignored; never commit real values):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JOBS_SECRET`, `NEXT_PUBLIC_SITE_URL`. Mirror the first three in Railway → Variables.

### Architecture & patterns to REUSE (don't reinvent)

**Track A (unchanged):**
- **Page content = an ordered `Block[]`** rendered by `components/SectionRenderer.tsx` via `components/sections/registry.ts`; one component per archetype, variants via a `variant` prop.
- **Shared primitives:** `components/ui/*` (`Button`, `Eyebrow`/`MonoLabel`, `clsx`) and `components/store/*` (`ProductCard`, `QtyStepper`, `OrderSummary`, `Field`/`SelectField`). **Reuse `Field` for admin forms** — the sign-in page does.
- **Tokens/layout:** `.container-mg` (1320px, site only — not in `/admin`), the `mg.*` Tailwind tokens, `[data-darkband]`, `.mg-underline`.
- **Chrome is built once** in `app/layout.tsx`.

**Track B (new):**
- **`lib/domain/`** — pure: types, Zod schemas, business rules. No I/O, no React, no framework. `money.ts`, `pricing.ts`, `permissions.ts` live here.
- **`lib/db/`** — `client.ts` (browser), `server.ts` (caller's session + RLS — use this for admin writes), `admin.ts` (service-role; scripts/jobs/tests only), `database.types.ts` (generated, `npm run db:types`).
- **`lib/services/`** — orchestration + `requirePermission()`. `auth.ts` exposes `getCurrentUser`/`requireUser`/`requirePermission`, cached per render.
- **Layering is enforced by ESLint** (`no-restricted-imports` in `.eslintrc.json`): `app → services → db`; `domain`, `blocks`, `render`, `integrations` are leaves. If the rule complains, the design is wrong.
- **Authorisation is three-layered:** RLS policies (deepest, unbypassable) → `requirePermission()` in services → permission-filtered UI. Permissions are `resource.action` rows in the DB, not an enum.
- **Versioning convention** on every editable entity: `draft_data` / `published_data` / `version` / `status`, with a single polymorphic `revisions` table.

### Setup/deploy gotchas ALREADY FIXED (don't re-hit)

- `package-lock.json` is committed (Railway's `npm ci` needs it).
- `starter/railway.json` buildCommand is **`npm run build`** only — Nixpacks already runs `npm ci`; a second one hits `EBUSY`.
- Railway **Root Directory must stay `design_handoff_modern_gentlemen/starter`**.
- **Playwright is pinned to 1.56.1** to match the browsers preinstalled at `/opt/pw-browsers` (build 1194). Never run `playwright install` locally; CI installs its own.
- **`@supabase/ssr` must stay ≥ 0.12.** Version 0.5.x cannot resolve the generated `Database` generic — every query silently degrades to `never`, discarding type safety across the data layer.
- **Route files may only export the page component** and Next's reserved symbols. Exporting a data array from `app/page.tsx` breaks `next build`; that is why `DEMO_SECTIONS` lives in `lib/demo/home-sections.ts`.
- **`server-only` is not used in `lib/db/admin.ts`** — it throws when imported outside Next, which breaks the seed script and test fixtures. A runtime browser check guards it instead.
- Redirects in route handlers are built from `request.nextUrl.clone()`, **not `new URL(..., request.url)`** — the latter can carry a different host (localhost vs 127.0.0.1, or an internal origin behind a proxy), and auth cookies are host-scoped.

### Next phase (recommended order)

1. **Phase 2 — Block manifest system.** `lib/blocks/defineBlock.ts` + a manifest per section, so one declaration drives the builder's insert menu, the properties panel, publish validation, the renderer, dynamic binding, and a conformance test suite. This is the spine everything else hangs off; do it before any admin UI.
2. **Phase 3** — templates, patterns, revisions/rollback, preview sessions.
3. **Phase 4** — admin design system (`components/admin/ui/*` on `mg.*` tokens) + the builder canvas.
4. **Phases 5–7** — CMS & media, commerce & integrations, then rewire the public site and complete the visual-regression suite.

Also outstanding from Phase 1: a repository layer over `lib/db`, and the RLS integration suite (positive *and* negative per role) against a local Supabase stack.

### How to run & verify

All commands from `design_handoff_modern_gentlemen/starter/`.

- **Dev:** `npm install && npm run dev` → http://localhost:3000
- **The four gates (run before every commit):**
  `npm run format:check && npm run lint && npm run typecheck && npm test`
- **Build:** `npm run build` — required before anything touching routing; Next enforces rules that only appear at build time.
- **E2E:** `npm run test:e2e`. Signed-in specs skip unless `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are exported.
- **Integration:** `npx supabase start && npm run test:integration`.
- **Seed / admin:** `npx tsx scripts/seed.ts`, `npx tsx scripts/create-admin.ts` (both idempotent).
- **Screenshot-diff loop** (Track A definition of done): drive the running app with the preinstalled Playwright, capture at 1440 / 909 / 375 + dark, diff against `design_handoff_modern_gentlemen/handoff/screenshots/*.png`.
- **Proving a refactor is render-safe:** build before and after, then diff the prerendered HTML in `.next/server/app/*.html` after stripping build IDs and chunk hashes. This is how the Prettier pass was verified to leave all 12 pages byte-identical.

### A new session's first actions

1. Read this handoff.
2. Read `design_handoff_modern_gentlemen/CLAUDE.md` — the design baseline, binding every session.
3. Check live state: `node design_handoff_modern_gentlemen/starter/scripts/status.mjs`.
4. For front-end work: the relevant `03_PAGES_AND_COMPONENTS.md` section + its `design_files/MG *.dc.html` prototype + matching screenshot.
5. Build on `claude/modern-gentlemen-admin-ntslwo`, run the four gates, and **update this file** before finishing.

---


# Track A — Front-end build (complete)

> Historical record of the design build, kept for its decisions log and
> verification evidence. The "Phase" numbers below are **Track A's** and are
> unrelated to the Track B phases in the snapshot table above.

## Phase 0 — Smoke test & deploy pipeline
- [x] `npm install` + `npm run dev` renders the scaffold locally (HTTP 200, full nav chrome + sections render on demo data); `npm run build` (Railway's command) also passes clean; `package-lock.json` generated & committed
- [x] Railway project created, Root Directory = `design_handoff_modern_gentlemen/starter`
- [x] Scaffold deployed live on a Railway URL (runs on demo data, zero env vars)
- [x] Auto-redeploy on push confirmed

## Phase 1 — Foundation
- [x] Fonts wired (Space Grotesk / Instrument Serif / IBM Plex Mono / Futura stack)
- [x] Color tokens + `[data-darkband]` verified in light AND dark (darkband now pins the full dark token set)
- [x] 1320px content container correct
- [x] No-flash light-default theme boot (inline script before paint)

## Phase 2 — Chrome  (ref: `04_CHROME.md`)
- [x] Header + 85px top scrim (frost on scroll, animated red underline) — `homepage-desktop.png`
- [x] Header hide-on-scroll (slide away down / reveal up, no resize — `EXECUTION_PLAN.md §10`)
- [x] Mega-menu (STYLE/GROOMING/WATCHES/CULTURE) — `02-nav-megamenu.png`
- [x] Slide-over drawer (accordion, member CTA, socials) — `drawer-open.png`
- [x] Search overlay (popular chips + EDITORIAL/STORE groups) — `01–02-search-overlay.png`
- [x] Bag drawer (empty + populated) — `bag-drawer.png`
- [x] Footer (always dark) — `footer.png`
- [x] Overlay scroll-lock / focus-trap / Esc (all overlays)
- [x] Theme toggle persists + no flash

## Phase 3 — Section blocks  (ref: `05_SECTION_BUILDER.md`, `MODULE_MAP.md`)
- [~] Section blocks brought to fidelity as pages need them — homepage's 7 done (heroCoverStar, latestGrid `sixUp`, featureSplit `fullBleed`, twoUpCategory, storyBand, filmStills, newsletter). Editorial milestone added **9 new blocks** (`categoryHero`, `featuredLead`, `articleGrid`, `ctaBand`, `editorialHero`, `manifesto`, `coverCards`, `pullQuote`, `masthead`) + a `statsBand` `cards` variant, all registered in `registry.ts`/`blockCatalog`, plus 2 shared primitives (`ui/RailLabel`, `ui/HairlineGrid`)
- [ ] TODO archetypes built when needed: `specTable`, `heroVogue01…10` (`membershipTiers` deferred — Membership was polished in-place as a bespoke client page; extract a reusable block only when a CMS page needs tiers, per `MODULE_MAP.md`)

## Phase 4 — Editorial pages
- [x] Homepage — `homepage-desktop.png` + `01–04-homepage.png` (7 sections, verbatim copy; screenshot-verified at 1440/909/375 + dark)
- [x] Category ×5 (Style/Grooming/Watches/Culture/Film) — `01–02-category-desktop.png` (full-bleed hero + subcategory chips, THE LEAD, article grid, red newsletter; article-driven from `lib/editorial.ts`; unknown slug → 404; screenshot-verified 1440/909/375 + dark)
- [x] About — `01–02-about-desktop.png` (hero, manifesto, By-the-Numbers stat cards, What-we-cover, pull quote, masthead, join band; verbatim copy; screenshot-verified 1440/909/375 + dark)
- [x] Membership (billing toggle, 3 tiers, FAQ) — `01–03-membership-desktop.png` (Reader/Member/Patron £0·£9/£86·£22/£211, MOST-POPULAR featured tier, benefits grid, testimonial, FAQ, join band; toggle + accordion + member-flag verified)
- [x] Article — `01–02-article-desktop.png` (**full 20-template library**: 9 hero × 17 body variants in `components/article/*`, template map + demo data in `lib/articles.ts`; reading-progress bar, kicker/byline, KEEP READING related; "Letter from the Editor" screenshot-matched, other 19 prototype-verified at 1440/909/375 + dark; all 35 category links resolve, unknown → 404)

## Phase 5 — Store
- [x] Store grid (filter chips, ADD→ADDED ✓, cart note) — `01–02-store-desktop.png` (hero + ?cat= sync + members band; screenshot-verified)
- [x] Product / PDP (sticky gallery, story, specs, related) — `01–03-product-desktop.png` (+ styled not-found matching `01-product-desktop.png`; per-slug state reset; assurances)
- [x] Bag page (line items + sticky summary, empty state) — `bag-desktop.png` (member-discount math + free-ship verified)
- [x] Checkout (4 steps + validation + confirmation) — `checkout-desktop.png` (step indicator, per-step validation, empty-bag guard, confirmation)

## Phase 6 — Section Library + builder
- [ ] Section Library picker page — `section-library.png`
- [ ] Drag-and-drop builder wired to the block registry

## Phase 7 — Quality pass
- [x] Responsive QA at 1024 / 768 / 414 / 360 + dark (subagent-driven audit → fixes) — swept every page type (home, 5 categories, about, membership, all article hero/body variants, shop, PDP, bag, checkout) + all overlays (search, drawer, bag). Fixed 5 majors (search overlay content clipped off-screen; bag line-totals clipped ≤468; spec-comparison table crushed ≤400; newsletter + CTA-band forms overflowing ≤360; About/Membership CTA headings overflowing) + ~11 minors (sub-44px touch targets, `min-[1025px]`→`min-[1024px]` grid gaps, article dek/drop-cap clamps, checkout confirmation stack). All changes are **mobile-only** (custom `min-[681px]:` breakpoints / `sm:` overrides) — the verified 909px desktop look is byte-for-byte unchanged; build stays clean.
- [ ] Accessibility: focus traps, `aria-expanded`, visible focus rings, reduced-motion, alt text
- [ ] SEO: per-route metadata, Product JSON-LD on PDPs, sitemap + robots
- [ ] Dark-mode sweep on every page (footer stays dark)
- [ ] Lighthouse / Core Web Vitals; image sizing; font loading
- [ ] Production imagery/video rights confirmed OR flagged (current media are placeholders)

---

## Deviations & decisions log
_Record anything you could not reproduce exactly, ambiguities, or choices made (e.g. which article templates were built, SHOP vs STORE route naming). One line each._

- Phase 0 setup: generated & committed `starter/package-lock.json` (was missing) so Railway's `npm ci` build succeeds.
- **Homepage exact-match pass (vs the bundled `Modern Gentlemen Homepage` prototype).** Text-run geometry (box, font, weight, tracking, colour) now matches the prototype at 1440 / 1024 / 909 / 768 / 414 / 375 in both themes. What it took, and what it did NOT match:
  - `html` gained `scrollbar-gutter: stable` + `overflow-x: clip` + `overscroll-behavior: none` + the theme background, and `body` gained `max-width: 100vw`. The gutter is load-bearing: without it the 1320px column centres on 60px gutters instead of the prototype's 52.5px, shifting every section 7.5px.
  - `text-rendering: geometricPrecision` on `body`. Hinted advances were inflating small text ~1px/glyph (~8% at 12px), which re-wrapped every dek and pull-paragraph off the design's line breaks. Space Grotesk also moved to the variable font (dropped the explicit `weight` array).
  - Hero rebuilt as the prototype's real default — `heroVariant: 'Cover bottom'` at `heroSize: 'Full screen'`: 100vh full-bleed cover, ONE bottom-rising scrim (no left-to-right wash, no 1px divider), card at left 44 / bottom 72, and the issue meta + vertical SCROLL rail as separate bottom-corner rails. The cover is now the prototype's **video** with the still as its poster.
  - Chrome: nav zone at `top:-2px` (content centres on y=34.5), `color:#fff`, burger 24×22 flush to the gutter with a 4px gap to the logo, icon buttons 38px and fully transparent (`iconBubbles` is off), half-filled-circle theme glyph, frost on hover as well as scroll, 0.45s 'Frost only' timing, hide-on-scroll thresholds 90/4. Mega-menu panel moved into flow with its own 1320 cap.
  - Added `--mg-muted` / `--mg-faint` / `--mg-band-border` tokens (the prototype's `tMuted` / `tFaint` / `bandBorder`). Section eyebrows are muted grey on light bands, not accent red; inset dark bands take a hairline only in dark mode.
  - `line-height` was the single biggest source of drift — the prototype leaves it `normal` in most chrome and card text where Tailwind imposes a fixed value. Where a size had to win over `Eyebrow`'s own class, the override is `!`-prefixed.
  - Breakpoints are now the prototype's (**680 / 820 / 1024**), replacing the invented ones: cards 6-up ≥1025 → 2-up ≤1024 → 1-up ≤680 (both The Latest and MG Film), two-up ≤820, section inset 22px / nav 20px ≤680.
  - Tile min-heights are the prototype's **content-box** 210px (150px 6-up) converted to border-box per tile: 268 padded+ruled, 266 padded, 210 plain. Missing this made every tile 58px short and dragged the whole page up 115px below the grid.
  - **Deliberately NOT reproduced (prototype defects):** its footer nav overflows the content column at ~768px, and its newsletter SUBSCRIBE button is pushed off-edge and clipped below ~400px (the app keeps `min-w-0` on the input so the button stays visible — this is the only remaining diff at 375/414). Also unmatched: a 2px vertical offset on the decorative ▶ glyph, whose line box comes from Arial in the prototype (an unstyled `<button>`) and Space Grotesk in the app — same fallback glyph either way.
  - **Header bag icon — user decision:** the homepage prototype and `handoff/screenshots/homepage-desktop.png` show 2 icons (search · theme) while `MG Header.dc.html` / `04_CHROME.md` specify 3 (with bag). Resolved as **bag on the store journey only** (`/shop`, `/product/*`, `/bag`, `/checkout`); editorial routes match the upload exactly. `BagDrawer` is gated on the same predicate so it can't outlive its trigger.
  - ⚠️ The hero cover and film previews now point at the prototype's **third-party placeholder videos** (see `starter/lib/media.ts`) — a studio trailer on a publisher CDN and a CC Wikimedia clip. They reproduce the design's moving cover but MUST be swapped for owned footage before launch (tracked under Phase 7 "Production imagery/video rights").
  - Seeded `speed-considered` as a real article so the hero CTA resolves (the prototype links to `MG Article.dc.html?a=speed-considered`).
- **Chrome follow-up pass — overlays, burger, hide-on-scroll, sharp corners.**
  - **Search overlay rebuilt** to the prototype: SEARCH / ESC rail (centred ≤680), red 26px magnifier, fluid `clamp(22px,6.5vw,34px)` field with the round clear button, POPULAR SEARCHES chips when empty, and EDITORIAL / STORE result groups with 64px thumbs (52px ≤680), per-group counts, hairline rules and row hover. Search index is now the prototype's 13-entry `searchIndex()` verbatim; results resolve to real routes. Scrolling the list blurs the field (phone keyboard), Esc and a >450ms-guarded scrim click close, and the query resets on close. **0 text-run mismatches** empty and with results.
  - **Drawer rebuilt** to the prototype: `sidebarEntry: 'Fade'` panel entry, EST. 2026 + serif tagline block, numbered accordion whose sub-lists are the mega-menu columns flattened (Curtain in on a per-link stagger, Collapse out over 300ms), secondary mono links carrying the same grow-underline, pinned BECOME A MEMBER and the FOLLOW ring row. **0 mismatches** closed and expanded.
  - **Mega-menu rebuilt**: 2-up grid columns (not a flex row), 500-weight 17px links with the translate-x hover, and the feature card as a background-image block with its own hover lift. **0 mismatches.**
  - **Burger hover** = `burgerHover: 'Staircase'`: the two 6px squares stretch to 12px and 17px bars on the springy .3s curve. The mark does **not** scale — the prototype's generic `[data-burger]:hover{scale(1.06)}` is overridden inside the nav by its header-scale rule.
  - **Hide-on-scroll fixed on mobile.** `navHover` was being set by hovering anywhere in the nav zone, so a stationary cursor at the top of the screen — or a tap on a touch device, which fires mouseenter but often no mouseleave — pinned the bar open and frosted for the rest of the session, silently disabling hide-on-scroll. Now scoped to nav *links* and the open panel exactly as the prototype's `_megaOver` does (hovering the logo/icons/gaps unfrosts but never closes an open panel — that gap bridges the nav and the dropdown), plus the prototype's document-level pointerdown guard. Verified step-for-step against the prototype at 375 and 1440.
  - **Sharp corners applied site-wide** (`sharpCorners: true` is the prototype's chosen default, and CLAUDE.md calls for minimal radius): every non-circular radius is now 0 across all 9 routes — article/category cards, membership tiers and billing toggle, CTA bands, spec tables, hairline grids, search chips, the bag count badge. Genuine circles keep 50%, matching the prototype's exception list (icon buttons, play buttons, socials, `data-circle`). Swept and confirmed clean on `/ /style /about /membership /shop /bag /checkout /article/* /product/*`.
  - Along the way: several elements were sized against the prototype's **content-box** boxes (it has no global `box-sizing` reset, so only form controls are border-box). Corrected the drawer panel (380 content → 471 rendered), mega-menu cap (1320 → 1416) and feature card (340 → 342), footer/drawer social rings, the search ESC ring, and the search input's UA 1px/2px padding.
  - Focus traps moved out of the removed `OverlayScrim` into a shared `lib/useFocusTrap.ts`, so the overlays keep their own prototype markup without losing WCAG behaviour.
  - Fixed a regression from the first pass: the hero's vertical SCROLL rail was hidden ≤680; the prototype has no mobile rule for it, so it shows at every width.
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
- Milestone 3 (editorial pages): Category/About/Membership built. Reuse-first — 9 new section blocks + a `statsBand` `cards` variant + 2 shared UI primitives (`RailLabel`, `HairlineGrid`); no Sanity schema added (superseded by Supabase; pages render from demo `Block[]`).
- Category demo articles live in `lib/editorial.ts` (verbatim from `MG Category.dc.html`, all 5 categories); `culture`/`film` have no store products so category pages are **article-driven**, not `productRow`. Article cards link `/article/{slugify(title)}` (Article page still scaffold).
- Category page uses server `notFound()` for unknown slugs (real 404) — cleaner than the PDP's styled client fallback, since the category page is a server component (no `useCart`).
- Editorial mono hero-eyebrows/kickers/tags are the bright accent **#ff4d5e** (hardcoded, matching the prototypes/screenshots), not the light-theme `--mg-accent-serif` (#c8102e).
- About/Membership sections use the prototypes' **22px** side gutters (via inline `paddingInline: max(22px, calc((100% - W)/2))` for W = 1320/1180/900/820), not `.container-mg`'s 48px (which Category correctly uses, matching its prototype).
- Membership polished **in place** as a bespoke `"use client"` page (billing toggle drives all 3 tiers); featured "MEMBER" CTA keeps the `useCart().setMember(true)` seam (15% off store-wide). Copy fix: tiers Reader/Debrief/Concierge → **Reader/Member/Patron**, "save 25%" → **SAVE 20%**.
- `ctaBand` is one block with 3 variants (`split` Category newsletter / `centered` Membership join / `link` About join) + a `gutter` prop (48 default, 22 for About/Membership); CTAs are dark pills (`#0d0d0d`), not the red `Button`. Email/newsletter submits stay demo-only (label flips to ✓).
- Milestone 4 (Article template system): built the **full 20-template library** (9 hero × 17 body). New namespace `components/article/*` (dispatcher `ArticleHero`/`ArticleBody` + inline variants — kept separate from `components/sections/` because `Timeline`/`Manifesto`/`Interview` already exist there with different designs). Data + template map in `lib/articles.ts`; body content is fixed per body-variant (lives in the components), matching the prototype's own model.
- Article stubs seeded from `lib/editorial.ts` titles/slugs (35 category links) + a canonical showcase per template (20), so every template is reachable and every category link resolves; unknown slug → `notFound()`. `assignTemplate` replicates the prototype `defaultTplFor` (explicit map + hash), **fixing the prototype's apostrophe-slug bug** (`the-coachbuilder-s-floor`, `inside-the-watchmaker-s-bench`).
- Article kicker uses each template's **semantic category** (The Debrief / Motoring / Watches…) rather than the prototype preview's blanket `category="Culture"` default — so the Letter kicker reads `THE DEBRIEF · NO. 042` vs the PNG's `CULTURE · NO. 042` (the only diff from the one article screenshot; consistent across all 20 templates). Only 1 of 20 templates has a reference PNG; the other 19 are **prototype-verified** (diffed against `MG Article.dc.html`).
- Article "Video" hero (Film Feature) falls back to its **poster image** (no external/licensed video asset) — same stance as the homepage hero; a self-hosted clip supplied via `DEFAULT_HERO_VIDEO`/per-article `videoUrl` enables playback. Reading-progress bar reuses the global reduced-motion rule (no per-component gate needed). KEEP READING related is category-aware (3 same-category siblings, falls back to any).
- Spec/Review body values the prototype hardcoded to `#f4f4f4` use `text-mg-fg` here so they read in both themes.
- Phase 7 responsive pass (subagent-audited, mobile-only): (1) **Search overlay** — dropped the illegal `container-mg` + `max-w-3xl` combo (CLAUDE.md forbids both on one element) for `mx-auto max-w-3xl px-6 sm:px-8`, and added `min-w-0` to the input (its intrinsic ~20ch width at `text-3xl` was forcing horizontal overflow). (2) **`.container-mg`** gets a `padding-inline: 24px` at ≤680px so phone content isn't over-inset by the flat 48px gutter. (3) **Spec-comparison table** (`BodySpec`) switched `overflow-hidden`→`overflow-x-auto` with `minmax()` columns so it scrolls within its card instead of crushing/overflowing the page ≤400px. (4) **Newsletter + CTA-band forms** stack (`flex-col`) with `min-w-0` inputs below ~360px instead of overflowing. (5) **Touch targets** bumped to ≥40–44px (WCAG 2.5.8): header burger 14px→44px, icon buttons 38px→40px, drawer/bag close 32–36px→40px, qty stepper `py-2`→`py-2.5`. (6) **Bag line items** — smaller image + `min-w-0` content + `shrink-0` line-total + `flex-wrap` qty row so the price stays visible ≤468px. (7) Article dek/`CtaBand`/`FeaturedLead` headings and the drop-cap get `min-[681px]:` clamps; grid gap breakpoints normalized `min-[1025px]`→`min-[1024px]`. **Desktop (≥909px) is unchanged** — every fix is gated behind a mobile breakpoint. Two benign residuals left as-is: a 26px phantom scrollWidth on the 768px PDP (masked by `overflow-x:clip`, no visible cut, no scrollbar) and the MOST-POPULAR tier notch reading red-on-red at narrow widths (by design).

- Header **hide-on-scroll** added as `lib/useHideOnScroll.ts` (owns both `scrolled` and `hidden`): slides the bar to `translateY(-100%)` on scroll-down past 120px, reveals on any scroll-up — the one motion `EXECUTION_PLAN.md §10` sanctions on top of the frost ("optional slide-away-on-scroll-down is fine"); the 72px height still never changes. The hook **ignores scroll while pinned** (drawer/search/bag/mega-menu open) and re-baselines on un-pin, because `useScrollLock`'s fixed-body technique moves the document scroll position — without that guard the unlock `scrollTo(0, savedY)` restore reads as a large scroll-down and hides the bar on every overlay close (it also stops the frost from dropping out while an overlay is open, which it previously did). Focus entering the header reveals it; the global reduced-motion rule already zeroes the 320ms slide.

## Track B — Backend & admin platform (see `06_SUPABASE.md`, and the plan in `/root/.claude/plans/`)

**Phase 0 — Toolchain** ✅
- [x] ESLint (+ layering `no-restricted-imports`), Prettier, Node 20 pin
- [x] Vitest workspace (unit/jsdom + integration/node), Playwright (e2e + visual)
- [x] GitHub Actions CI: format → lint → typecheck → unit → integration → build → e2e/visual
- [x] Sanity scaffold + `styled-components` removed
- [x] `lib/domain/money.ts` + `pricing.ts` extracted from `CartProvider`; member-discount rounding bug fixed

**Phase 1 — Data foundation** ✅
- [x] Migrations `0001`–`0009` written **and applied** to `qnfoztnyxhubnnulpfwt` (41 tables, RLS on all 41, 88 policies)
- [x] RBAC: 40 permissions × 5 roles as data; `has_permission()` / `is_staff()` / `is_admin()` SQL functions
- [x] `database.types.ts` generated; typed clients in `lib/db/`
- [x] Seeded from the live demo modules: 16 products, 5 categories, 7-section homepage
- [x] RLS verified empirically against the live project (anon cannot read drafts, is refused INSERT, sees no revisions/import jobs)
- [x] Security advisor findings fixed (mutable `search_path`; two functions reachable over REST RPC)
- [ ] Repository layer over `lib/db`
- [ ] RLS integration suite (positive + negative per role) against a local Supabase stack

**Phase 1c — Auth** ✅
- [x] Admin account created via the Auth Admin API; `scripts/create-admin.ts` idempotent
- [x] `middleware.ts` — session refresh + `/admin` gate preserving the destination
- [x] `lib/services/auth.ts` + `lib/domain/permissions.ts` (typed `Permission` union, `PermissionSet`)
- [x] `/sign-in` (reuses `components/store/Field`), gated `/admin`, sign-out, OAuth/recovery callback
- [x] E2E: redirect, bad credentials, sign-in → 40 permissions, sign-out, already-signed-in bounce

**Phases 2–7** — see the snapshot table at the top of this file. Not started.

**Known issues**
- [ ] `/admin` still renders inside the public header/footer (shares the root layout). Phase 4 replaces it with the admin shell.
- [ ] The service-role key passed through a chat transcript — rotate it in the Supabase dashboard when convenient. It is read from the environment, so rotation needs no code change.

## Still deferred
- [ ] Real membership subscriptions vs. flag-only
- [ ] Newsletter ESP integration (Supabase capture works standalone)
- [ ] Production imagery/video + rights
- [ ] Remaining article templates & Section Library modules
