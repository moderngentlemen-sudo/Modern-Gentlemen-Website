# Build Progress Tracker

Update this as you build. Mark items `[x]` done, `[~]` in progress, `[!]` blocked. Add a note for any deviation from the design and why. This doubles as the **post-build verification report** required by `IMPLEMENTATION_BRIEF.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & screenshot-verified · `[!]` blocked/needs decision

---

## Phase 0 — Smoke test & deploy pipeline
- [ ] `npm install` + `npm run dev` renders the scaffold locally
- [ ] Railway project created, Root Directory = `design_handoff_modern_gentlemen/starter`
- [ ] Scaffold deployed live on a Railway URL
- [ ] Auto-redeploy on push confirmed

## Phase 1 — Foundation
- [ ] Fonts wired (Space Grotesk / Instrument Serif / IBM Plex Mono / Futura stack)
- [ ] Color tokens + `[data-darkband]` verified in light AND dark
- [ ] 1320px content container correct
- [ ] No-flash light-default theme boot (inline script before paint)

## Phase 2 — Chrome  (ref: `04_CHROME.md`)
- [ ] Header + 85px top scrim (frost on scroll, animated red underline) — `homepage-desktop.png`
- [ ] Mega-menu (STYLE/GROOMING/WATCHES/CULTURE) — `02-nav-megamenu.png`
- [ ] Slide-over drawer (accordion, member CTA, socials) — `drawer-open.png`
- [ ] Search overlay (popular chips + EDITORIAL/STORE groups) — `01–02-search-overlay.png`
- [ ] Bag drawer (empty + populated) — `bag-drawer.png`
- [ ] Footer (always dark) — `footer.png`
- [ ] Overlay scroll-lock / focus-trap / Esc (all overlays)
- [ ] Theme toggle persists + no flash

## Phase 3 — Section blocks  (ref: `05_SECTION_BUILDER.md`, `MODULE_MAP.md`)
- [ ] 13 scaffolded blocks brought to fidelity (as pages need them)
- [ ] TODO archetypes built when needed: `specTable`, `membershipTiers`, `heroVogue01…10`

## Phase 4 — Editorial pages
- [ ] Homepage — `homepage-desktop.png` + `01–04-homepage.png`
- [ ] Category ×5 (Style/Grooming/Watches/Culture/Film) — `01–02-category-desktop.png`
- [ ] About — `01–02-about-desktop.png`
- [ ] Membership (billing toggle, 3 tiers, FAQ) — `01–03-membership-desktop.png`
- [ ] Article (templates used in refs first) — `01–02-article-desktop.png`

## Phase 5 — Store
- [ ] Store grid (filter chips, ADD→ADDED ✓, cart note) — `01–02-store-desktop.png`
- [ ] Product / PDP (sticky gallery, story, specs, related) — `01–03-product-desktop.png`
- [ ] Bag page (line items + sticky summary, empty state) — `bag-desktop.png`
- [ ] Checkout (4 steps + validation + confirmation) — `checkout-desktop.png`

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

- …

## Deferred (Phase 2 backlog — see `EXECUTION_PLAN.md §9`)
- [ ] Sanity CMS wiring
- [ ] Shopify/Stripe real checkout
- [ ] Member auth / real subscriptions
- [ ] Newsletter POST to ESP
- [ ] Remaining article templates & Section Library modules
