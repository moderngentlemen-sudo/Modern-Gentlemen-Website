# Build Progress Tracker

Update this as you build. Mark items `[x]` done, `[~]` in progress, `[!]` blocked. Add a note for any deviation from the design and why. This doubles as the **post-build verification report** required by `IMPLEMENTATION_BRIEF.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & screenshot-verified · `[!]` blocked/needs decision

---

## 📍 Current Status & Session Handoff — READ FIRST

**Branch:** `claude/continue-previous-work-lykdt2` (Milestones 3–4 + the Phase 7 responsive pass committed here). M1+M2 were **merged to `main` via PR #1** (from `claude/project-setup-docs-xfx8td`); this branch started even with that merged content. **Deploy:** live on Railway, running on demo data. **Last milestone:** M4 (Article template system), followed by a **mobile/responsive QA pass** (Phase 7 slice — subagent-audited at 1024/768/414/360 + dark, majors + minors fixed, desktop unchanged).

### Progress snapshot
| Phase / Milestone | Scope | Status |
|---|---|---|
| Phase 0 — Setup & deploy | deps + `package-lock.json`, clean build, Railway pipeline | ✅ done, **live** |
| Milestone 1 — Homepage + chrome | foundation, all chrome (header/mega/drawer/search/bag/footer/theme), 7 homepage section blocks, homepage | ✅ done, screenshot-verified |
| Milestone 2 — Store flow | Shop, Product/PDP, Bag, Checkout + shared `components/store/*` primitives | ✅ done, merged (PR #1) |
| Milestone 3 — Editorial pages | Category ×5, About, Membership + 9 new section blocks + 2 shared UI primitives (`ui/RailLabel`, `ui/HairlineGrid`) + `lib/editorial.ts` | ✅ done, screenshot-verified |
| Milestone 4 — Article template system | full library: 9 hero × 17 body → 20 templates (`components/article/*`) + `lib/articles.ts` (seeds 35 category links + 20 showcases) + reading-progress bar + KEEP READING | ✅ done, screenshot-verified |

Key commits: `5f9bc1d` Phase 0 → `d127c94` M1 → `ad99224` Railway build fix → `4610288` M2 (→ merged as PR #1) → M3 editorial pages → M4 article system (this branch).

### What runs today
Runs **100% on demo data — no backend, env vars, or accounts** (`cd design_handoff_modern_gentlemen/starter && npm install && npm run dev`). Live: the **Homepage**, the full **Store** journey (Shop → Product → Bag → Checkout, header bag drawer, member-discount math, demo checkout), the 5 **Category** landings (`/style /grooming /watches /culture /film`), **About**, **Membership** (billing toggle + tiers + FAQ + join-sets-member-flag), and **Article** (`/article/[slug]` — 20 templates; all 35 category links resolve; unknown slug → 404).

**Every design page is now built.** The remaining work is the Section-Library builder (Phase 6), a global QA pass (Phase 7 — SEO/a11y/Lighthouse), and Track B (Supabase + Stripe).

### Architecture & patterns to REUSE (don't reinvent)
- **Page content = an ordered `Block[]`** rendered by `components/SectionRenderer.tsx` via `components/sections/registry.ts`; one component per archetype, **variants via a `variant` prop**. `app/page.tsx` `DEMO_SECTIONS` is the reference pattern.
- **Shared primitives:** `components/ui/*` (`Button`, `Eyebrow`/`MonoLabel`, `clsx`) and `components/store/*` (`ProductCard`, `QtyStepper`, `OrderSummary`, `Field`/`SelectField`).
- **Tokens/layout:** `.container-mg` (1320px), the `mg.*` Tailwind tokens, `[data-darkband]` (pins the full dark token set), and the `.mg-underline` grow-underline utility — in `app/globals.css` / `tailwind.config.ts`.
- **Cart + catalog are FINISHED — do not rebuild:** `lib/cart/CartProvider.tsx` (`useCart()`), `lib/cart/types.ts` (`CartApi`), `lib/catalog.ts` (16 products + `allProducts/byGroup/getProduct/related/formatGBP`, `groups`). Commerce rules (15% member, free-ship ≥£50 else £4.95, qty-0-removes) are correct.
- **Chrome is built once** in `app/layout.tsx`; every page inherits it. The homepage hero bleeds behind the fixed 72px header via `-mt-[72px]`.
- **Decisions to respect** live in the **Deviations & decisions log** at the bottom of this file (frost-only header, square corners / `sharpCorners`, STORE label + `/shop` route, `?cat=` sync, demo payment, styled PDP not-found, footer always dark…).

### Setup/deploy gotchas ALREADY FIXED (don't re-hit)
- `package-lock.json` is committed (Railway's `npm ci` needs it).
- `starter/railway.json` buildCommand is **`npm run build`** only — Nixpacks already runs `npm ci`; a second one hits `EBUSY`.
- Railway **Root Directory must stay `design_handoff_modern_gentlemen/starter`** (the repo root has no app).

### Next phase (recommended order)
1. ~~**Editorial pages**~~ ✅ **DONE (M3)** — Category ×5, About, Membership built + screenshot-verified. See the new blocks in `components/sections/` and demo data in `lib/editorial.ts`.
2. ~~**Article**~~ ✅ **DONE (M4)** — full 20-template system in `components/article/*` + `lib/articles.ts`. All 9 heroes + 17 bodies built; the "Letter from the Editor" screenshot is pixel-matched, the rest prototype-verified.
3. **Phase 6** (recommended next) — Section Library picker + drag-and-drop builder (`components/builder/SectionEditor.tsx`; dnd-kit already installed).
4. **Phase 7** — global QA: per-route SEO metadata (Article already has `generateMetadata`), Product JSON-LD, sitemap/robots, full a11y + responsive + dark sweep, Lighthouse.
5. **Track B** — Supabase + Stripe (see the Track B checklist below + `06_SUPABASE.md`): provision, apply `supabase/migrations/0001_init.sql` + `seed.sql`, swap demo arrays → `lib/queries.ts` (note: `getArticle()` should return the same resolved shape as `lib/articles.ts getArticleBySlug`), add auth + a Supabase cart adapter + real Stripe checkout/webhook, then remove the legacy Sanity scaffold. (A Supabase MCP integration is connected in-session for provisioning.)

Missing section archetypes to build when a page needs them: `specTable`, `heroVogue01…10` (`membershipTiers` deferred — Membership is a bespoke in-place page).

### How to run & verify
- **Dev:** `cd design_handoff_modern_gentlemen/starter && npm install && npm run dev` → http://localhost:3000.
- **Prod/Railway check:** `npm run build` (must stay clean — it's what Railway runs).
- **Screenshot-diff loop** (the definition of done): drive the running app with the **preinstalled** global Playwright (`require('/opt/node22/lib/node_modules/playwright')`; Chromium auto-found via `/opt/pw-browsers` — never run `playwright install`), capture at 1440 / 909 / 375 + a dark pass, and diff against `design_handoff_modern_gentlemen/handoff/screenshots/*.png`. Fix every visible diff before ticking a box here.

### A new session's first actions
Read, in order: **this handoff** → `design_handoff_modern_gentlemen/CLAUDE.md` (tokens/rules — read every session) → for the page you're building, `03_PAGES_AND_COMPONENTS.md` + its `design_files/MG *.dc.html` prototype + the matching `handoff/screenshots/*.png`. Then build on `claude/continue-previous-work-lykdt2`, screenshot-verify, and tick this file as you go.

---

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

- **Search clear button — brand decision: no circle.** The prototypes drew the ✕ that appears once you start typing (`[data-sclear]`) as a 34px disc — `border-radius:50%` + a 1px grey border + a grey fill. That ring is gone: the glyph now sits bare on the field, and hover is colour-only (accent red) rather than a filled pill. Changed **in the prototypes** (`MG Header.dc.html`, `Modern Gentlemen Homepage.dc.html`) so the design canon and the build agree — `SearchOverlay.tsx` never drew the ring, so the app needed no change. The button also **drops its `data-circle` attribute**, which is load-bearing: `body[data-square="true"] [data-circle]` and the light-theme `[data-circle]` rule both re-apply the radius/border with `!important`, so stripping the inline style alone would not have removed it. The 34×34 box is kept (touch target + the input's reserved `padding-right:40px`). Every other `[data-circle]` control — the ESC close ✕, bag close, menu close, sidebar chevrons — is untouched and still circled.

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
