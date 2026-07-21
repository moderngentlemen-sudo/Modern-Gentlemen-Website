# Execution Plan — Modern Gentlemen (pixel-perfect build for Railway)

This is the master build plan for the next engineer/Claude session. Read `README.md` first, then this, then keep `PROGRESS.md` open and tick things off as you go.

**Objective:** a **1:1, pixel-perfect** reproduction of **every page** of the Modern Gentlemen design, running as a Next.js app and **deployed on Railway**.

---

## 0. Stack decision (final for v1)

| Concern | v1 decision | Later (optional) |
|---|---|---|
| Framework | **Next.js (App Router) + React 19 + TypeScript** (already scaffolded in `starter/`) | — |
| Styling | **Tailwind CSS 3.4** + CSS variables (tokens already wired) | — |
| Content | **Hardcoded from the prototypes** (in-repo TS data / demo arrays) | Sanity CMS (seam already present in `lib/sanity/`) |
| Store data | **Ported catalog** in `lib/catalog.ts` (16 products) | Shopify Storefront API |
| Cart / checkout | **Local cart** (localStorage) behind `CartApi`; demo checkout | Shopify/Stripe hosted checkout behind the same seam |
| Hosting | **Railway** (see `RAILWAY_DEPLOYMENT.md`) | — |

**Why defer Sanity + Shopify:** the brief is a pixel-perfect, deployable replica. Hardcoded content + the local cart produce an identical-looking, fully working, self-contained site with **no external accounts or keys** — ideal for Railway. The scaffold already isolates both behind seams (`lib/cart/types.ts#CartApi`, the commented `sanityFetch` calls), so adding them later needs **no UI rework**. Do not let CMS/commerce wiring block the pixel-perfect work.

> If the project owner says they want the CMS or real payments in v1, jump to `§9 Deferred / optional` — the hooks are ready — but still finish the visual fidelity first.

---

## 1. Ground rules (non-negotiable)

From `IMPLEMENTATION_BRIEF.md` + `CLAUDE.md`:

1. **No reinterpretation, simplification, merging, or "cleanup."** Non-standard spacing, sharp corners, and odd sizes are intentional. Build as designed.
2. **Recreate from the `.dc.html` source**, not by eyeballing the PNG — the code has the exact structure and copy. Use the PNG to verify the result.
3. **Tokens only from `design-tokens.json` / `CLAUDE.md`.** Never introduce a color, font, or spacing value not derived from them.
4. **Breakpoints only from the prototypes.** Known: **1024 / 900 / 680px** (store grid also steps at 1024/680). Confirm per component in the `.dc.html` media queries. Do not invent breakpoints.
5. **Do NOT port the prototype runtime** (`support.js`, `image-slot.js`, `dc-import`, `sc-if`). Reproduce the visible result with idiomatic React. Only `mg-catalog.js` + `mg-bag.js` carry real logic (already ported to `lib/`).
6. **Accessibility (WCAG 2.2 AA) without changing visuals:** focus traps in overlays, `aria-expanded` on triggers, Esc to close, visible focus rings, alt text on all images, `prefers-reduced-motion` gating. Tokens already meet AA contrast — verify any new pairing.
7. **Build chrome ONCE** (`components/chrome/*`, rendered in `app/layout.tsx`). The prototype duplicates it per page — you won't.

**Copy/label note:** the brand's final decision renamed **SHOP → STORE** in user-facing nav/labels (see `reference_chats/chat18.md`). The homepage prototype uses "STORE". Some spec docs still say "SHOP" — **use "STORE"** in the UI, keep the route `/shop` (or rename to `/store` consistently — pick one and be consistent).

---

## 2. Tooling & environment

- **Node 20+**, npm. `cd design_handoff_modern_gentlemen/starter && npm install`.
- **Chromium + Playwright are preinstalled** in this environment (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; do NOT run `playwright install`). Use them for the screenshot-diff verification loop (§3).
- Dev server: `npm run dev` → http://localhost:3000. Production check: `npm run build && npm run start`.

---

## 3. The self-verification loop (do this for EVERY screen/component)

1. **Build** the screen from `design_files/<page>.dc.html` (structure + exact copy).
2. **Run** it and **screenshot your output** with Playwright at the same width as the reference (~1280–1440px desktop; then 375/768 for mobile). Capture light theme by default; also check dark.
3. **Compare side-by-side** against the matching `handoff/screenshots/*.png` (manifest below).
4. **List and fix every visible diff** — spacing, alignment, color, type size/weight, proportion, radius — before moving to the next screen.
5. **Record** the result (and any unavoidable deviation) in `PROGRESS.md`.

**Screenshot manifest (reference → source page):**

| Reference screenshot(s) | Screen | Source prototype |
|---|---|---|
| `homepage-desktop.png`, `01–04-homepage.png` | Homepage (hero + scrolled sections) | `Modern Gentlemen Homepage.dc.html` |
| `02-nav-megamenu.png` (+`01-`) | Mega-menu (STYLE) | Homepage / `MG Header.dc.html` |
| `drawer-open.png` | Slide-over drawer | Homepage |
| `01–02-search-overlay.png` | Search overlay (empty + results) | Homepage |
| `bag-drawer.png` | Bag drawer (empty state) | `MG Header.dc.html` |
| `footer.png` | Footer (always dark) | `MG Footer.dc.html` |
| `01–02-category-desktop.png` | Category landing | `MG Category.dc.html` |
| `01–02-article-desktop.png` | Article | `MG Article.dc.html` |
| `01–02-about-desktop.png` | About | `MG About.dc.html` |
| `01–03-membership-desktop.png` | Membership (hero/tiers/FAQ) | `MG Membership.dc.html` |
| `01–02-store-desktop.png` | Store grid | `MG Store.dc.html` |
| `01–03-product-desktop.png` | Product (gallery/story/specs) | `MG Product.dc.html` |
| `bag-desktop.png` | Bag page | `MG Bag.dc.html` |
| `checkout-desktop.png` | Checkout (step 1 + summary) | `MG Checkout.dc.html` |
| `section-library.png` | Section Library picker | `Modern Gentlemen Section Library.dc.html` |

**Known gaps in the reference set** (reproduce from source `.dc.html` + logic, self-verify your own capture): mobile layouts, populated bag drawer, checkout confirmation, and hover/"ADDED ✓" states. See `VERIFICATION_REPORT.md`.

---

## 4. Build order (phases)

Work top-to-bottom. Each phase ends when its items pass §3 and are checked off in `PROGRESS.md`.

- **Phase 0 — Smoke test & deploy pipeline.** `npm install`, `npm run dev`, confirm it renders. Then wire Railway (`RAILWAY_DEPLOYMENT.md`) and get the scaffold live on a Railway URL. Getting deploy working *first* means every later phase ships continuously.
- **Phase 1 — Foundation.** Verify fonts (Space Grotesk / Instrument Serif / IBM Plex Mono via `next/font`; Futura CSS stack for nav), color tokens, 1320px container, and the **no-flash light-default theme boot** (inline script in `app/layout.tsx` setting `data-mgtheme` before paint). Verify `[data-darkband]` regions stay dark in both themes.
- **Phase 2 — Chrome (§6).** Header + scrim, mega-menu, drawer, search overlay, bag drawer, footer, theme toggle. Everything else nests in this.
- **Phase 3 — Section blocks (§7 pages depend on these).** Bring the 13 existing `components/sections/*` to fidelity + build any TODO archetypes you need (see `MODULE_MAP.md`).
- **Phase 4 — Editorial pages.** Homepage → Category → About → Membership → Article.
- **Phase 5 — Store.** Store grid → Product → Bag → Checkout (+ bag drawer already in chrome).
- **Phase 6 — Section Library page + builder** (the drag-and-drop authoring canvas; `05_SECTION_BUILDER.md`).
- **Phase 7 — Quality pass.** Full responsive QA (1024/900/680 + 375), a11y (focus traps, aria, reduced-motion), SEO metadata per route, Lighthouse, and dark-mode sweep. Then write the post-build section of `PROGRESS.md`.

---

## 5. Definition of Done (global)

A screen is done when: it is visually indistinguishable from its reference screenshot at desktop width; its responsive behavior matches the prototype's media queries at 1024/900/680/375; all interactions work (hover, open/close, add-to-bag, validation, etc.); it passes the a11y checklist; and it's committed. The whole site is done when every card in §6–§8 is checked in `PROGRESS.md` and Phase 7 passes.

---

## 6. Chrome — task cards (`components/chrome/`, spec `04_CHROME.md`)

**Header + top scrim** — fixed; transparent over heroes → frosted (backdrop-blur + subtle bg) on scroll/hover. LEFT: red square (opens drawer) + MG monogram (`/mg-logo.svg`). CENTER: `STYLE · GROOMING · WATCHES · CULTURE · FILM · STORE` in Futura, each with the **red animated underline 6px below text**. RIGHT: bag (red count badge) · search · theme toggle. Top scrim: fixed, **85px**, `linear-gradient(180deg, rgba(8,8,9,0.34), rgba(8,8,9,0.14) 52%, transparent)`. Burger canon = "Sq thin pair". *DoD:* matches `homepage-desktop.png` header; frosts on scroll; underline animates.

**Mega-menu** — STYLE/GROOMING/WATCHES/CULTURE open a full-width frosted dropdown (2 link columns + featured image card with a kicker). Desktop: open on hover/focus; touch: open on tap. Proper `aria-expanded`. *DoD:* matches `02-nav-megamenu.png`.

**Slide-over drawer (left)** — accordion categories (chevron rotates to reveal sublinks), secondary link row (ABOUT/CONTACT/ARCHIVE), member CTA pill, socials (Instagram/X/YouTube/LinkedIn), wordmark logo at top. Red underline on links. Closes on ✕/Esc/scrim. Scroll-locked. *DoD:* matches `drawer-open.png`.

**Search overlay** — full-screen fade-up, live filter. Empty state = "POPULAR SEARCHES" chips. Results grouped **EDITORIAL** + **STORE**, each a red mono header + count; product rows link to PDP with price. Clear (×) button. *DoD:* matches `01–02-search-overlay.png`.

**Bag drawer** — slide-in from right: line items (qty steppers + remove), member-discount line, subtotal, free-shipping-over-£50 note, CHECKOUT + VIEW FULL BAG, empty state → shop. Live via `CartProvider`. *DoD:* empty matches `bag-drawer.png`; populated matches the bag page layout.

**Footer** — **always dark** (never theme-reactive). Brand block + tagline, nav row (STYLE…STORE), social row, copyright + legal row. *DoD:* matches `footer.png`.

**Overlay behavior (all)** — iOS-safe fixed-body scroll lock (save scrollY; restore with `scroll-behavior:auto`); Esc closes; focus trapped; one overlay at a time; return focus to trigger. Use a shared `useScrollLock` hook (present in `lib/`).

**Theme toggle** — persists `localStorage['mg-theme']`, sets `[data-mgtheme]`, default light, booted before paint.

---

## 7. Pages — task cards (spec `03_PAGES_AND_COMPONENTS.md`)

> Every page body is an ordered array of section blocks rendered by `SectionRenderer` (keeps it composable). Copy is verbatim from the `.dc.html`.

### Homepage — `Modern Gentlemen Homepage.dc.html` → `app/page.tsx`
Sections in order: **Hero "Cover Star"** (right ~54% cover image meeting a dark left panel at a 1px divider; overlapping lower-left headline block; still image or muted-autoplay video set imperatively; mobile = full-bleed with its own height/align, "Fullscreen" = 100svh behind header) → **The Latest** (magazine grid; the shipped variant is a 6-up with a red membership tile) → **Style feature** (full-bleed band + frosted caption) → **Grooming + Watches two-up** → **Story band "Our Promise"** → **MG Film** (3-up video stills; hover preview; first auto-plays on scroll-in; click → video lightbox) → **Newsletter "The Debrief"** → Footer. Verbatim hero copy: eyebrow "COVER STORY — ISSUE 042", serif kicker "The Cover Interview", headline "Speed, Considered", CTA "READ THE COVER STORY". *DoD:* matches `homepage-desktop.png` + `01–04-homepage.png`.

### Category landing — `MG Category.dc.html` → `app/[category]/page.tsx`
One reusable page keyed by **Style / Grooming / Watches / Culture / Film** (5 instances). Full-bleed hero band (title + intro) stays edge-to-edge; editorial content column below (optionally narrowed to ~1180px, hero stays full-bleed). *DoD:* matches `01–02-category-desktop.png` for each category.

### Article — `MG Article.dc.html` → `app/article/[slug]/page.tsx`
Template-driven. Prototype offers ~20 hero/body templates via a client toggle; in the build the template is a **field on the article data**, not a toggle. Build the hero/body variants **actually shown in the reference screenshots first** (`01–02-article-desktop.png`), then add others as content requires. Body = rich text with inline images/pull-quotes. *DoD:* the built templates match the article screenshots; unused templates are documented as pending in `PROGRESS.md`.

### About — `MG About.dc.html` → `app/about/page.tsx`
Masthead/brand statement, team/masthead, editorial imagery — composed from section blocks. *DoD:* matches `01–02-about-desktop.png`.

### Membership "The Debrief" — `MG Membership.dc.html` → `app/membership/page.tsx`
Billing toggle (monthly/annual switches prices), **3 tier cards** (name, price, features, CTA), **FAQ accordion**. Joining sets the member flag (15% off store-wide via `CartProvider`). *DoD:* matches `01–03-membership-desktop.png`; toggle + accordion work.

### Store — `MG Store.dc.html` → `app/shop/page.tsx`
Filter chips synced to category (`?cat=`). Product grid → PDP. "ADD" adds to cart; button stays **"ADDED ✓"** per slug (no revert). Cart-note band reflects live count + subtotal. Grid steps at 1024/680. *DoD:* matches `01–02-store-desktop.png`.

### Product (PDP) — `MG Product.dc.html` → `app/product/[slug]/page.tsx`
Breadcrumb; **sticky gallery** (main + clickable thumbnails, selected index in state); title/price/member-price/blurb/material; **qty stepper + ADD TO BAG** (stays "ADDED", reset on slug change); assurances row; **THE STORY** (paras); **SPECIFICATIONS** (2-col → 1 centered col ≤mobile); **related** 4-up. Unknown slug → `notFound()` server-side (no flash). *DoD:* matches `01–03-product-desktop.png`.

### Bag — `MG Bag.dc.html` → `app/bag/page.tsx`
Two-column: line items (image, name→PDP, each-price, qty stepper, remove, line total) + sticky order summary (subtotal, member discount, shipping [free ≥£50 else £4.95], total, CHECKOUT, become-a-member CTA, secure note). Empty state → shop. Collapses to 1 col ≤900px. *DoD:* matches `bag-desktop.png` + `bag-empty` state.

### Checkout — `MG Checkout.dc.html` → `app/checkout/page.tsx`
4 steps **Contact → Shipping → Payment → Review** → **confirmation**. Clickable step indicator (jump back to completed steps); per-step validation (field errors + invalid styling). `placeOrder()` builds `MG-XXXXXX` id, clears cart, shows confirmation. **Payment is demo** in v1 ("no real card is charged"). Inner column ~1160px; flex column so footer sits at bottom on short states. *DoD:* matches `checkout-desktop.png`; validation + step nav + confirmation work.

### Section Library page — `Modern Gentlemen Section Library.dc.html`
The module picker/gallery. Build the picker UI to match `section-library.png`; wire it to the block registry so modules can be previewed/inserted. Ties into Phase 6. *DoD:* matches `section-library.png`.

---

## 8. Section blocks (`components/sections/`, spec `05_SECTION_BUILDER.md` + `MODULE_MAP.md`)

13 archetype blocks are scaffolded: `heroCoverStar, latestGrid, featureSplit, twoUpCategory, storyBand, filmStills, newsletter, numberedIndex, productRow, statsBand, interview, timeline, testimonials`. **One component per archetype; variants via a `variant` prop** — do NOT build 125 components. Bring the ones each page needs to fidelity first. Build the flagged TODO archetypes when a page needs them: `specTable`, `membershipTiers`, and the 10 full-fidelity "Vogue" showcase heroes (`heroVogue01…`, library #116–125). Follow `MODULE_MAP.md §How to add one` (component + `registry.ts` + schema).

---

## 9. Deferred / optional (Phase 2 — only if the owner asks)

- **Sanity CMS:** uncomment `sanityFetch` in the page files, add schemas (already stubbed in `sanity/schemas/`), move hardcoded content into the CMS. Env: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`.
- **Shopify/Stripe checkout:** implement an adapter satisfying `lib/cart/types.ts#CartApi`; swap it into `CartProvider`; either redirect to hosted checkout after step 3 or embed Stripe Elements in the Payment step. Never build a raw card form without a PCI provider.
- **Member auth / real subscriptions, newsletter POST (ESP), production imagery & video** (current media are placeholders — confirm rights before launch), remaining article templates, remaining Section Library modules.

All are documented in `HANDOFF_CHECKLIST.md`. None block v1.

---

## 10. Watch-outs (learned from the prototype history — see `reference_chats/`)

- **No-flash theme boot** must be a synchronous inline script before paint, or dark/light flickers on load.
- **Header must not visibly resize on scroll** — only the background frosts in (the brand rejected resize motion). Optional slide-away-on-scroll-down is fine.
- **Video autoplay:** set `videoEl.muted = true` then `play()` imperatively (React `muted` prop is unreliable); gate on `prefers-reduced-motion`.
- **Scroll lock:** use the fixed-body technique or overlays cause a scroll-to-top jump on close (esp. iOS).
- **localStorage ownership:** the app owns only `mg-bag`, `mg-member`, `mg-theme` — never clear keys you didn't write.
