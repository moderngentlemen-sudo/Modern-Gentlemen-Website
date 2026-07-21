# Handoff: Modern Gentlemen — Full Website

> Master document. A developer who was **not** in the design conversation should be able to build the site from this folder alone. Read this file top to bottom first, then the numbered specs.

---

## Overview
**Modern Gentlemen** is a men's editorial + lifestyle brand (style, grooming, watches, culture, film) with an integrated shop. This handoff covers the **entire site**: homepage, category landing pages, an article/editorial system, About, a membership page ("The Debrief"), and a full storefront (Shop → Product → Bag → Checkout), plus the shared header/footer chrome.

The signature ask on top of a faithful rebuild: a **drag-and-drop section builder** so editors can compose pages from a library of ~125 brand-styled section modules. That is spec'd in detail in `04_SECTION_BUILDER.md` and is the reason the recommended stack leans on a structured-content CMS.

**Aesthetic:** dark, editorial, luxury-automotive. Racing-red accent (`#C8102E`), monochrome photography, a serif / mono / grotesk type mix. Default theme is **light**; a persistent light/dark toggle lives in the header.

---

## About the design files
The files in `design_files/` are **design references authored in HTML** — high-fidelity prototypes that show the intended look, layout, copy, and behavior. **They are not production code to copy directly.** They are built as "Design Components" (`.dc.html`) on a small custom runtime (`support.js`) with an inline-styles-only constraint; that runtime is a prototyping tool, not a shipping framework.

Your job is to **recreate these designs in a real Next.js + React + Tailwind codebase** using idiomatic patterns (components, a Tailwind theme, a CMS-backed content layer). Treat the `.dc.html` files as the source of truth for **visual detail and copy**, and this README + numbered specs as the source of truth for **architecture and behavior**.

Two files in `design_files/` are genuinely reusable production logic, not just references — port their data/logic directly:
- **`mg-catalog.js`** — the 16-product catalog (data + helper functions). Lift the product data and the helper API shape.
- **`mg-bag.js`** — the cart/membership state model + event contract. Reimplement this as a React context / store (see `03_PAGES_AND_COMPONENTS.md`).

`support.js`, `image-slot.js`, and the `.dc.html` runtime wrappers are **prototype-only — do not port them.**

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions in the prototypes are final. Recreate the UI pixel-accurately using Tailwind + the codebase's own components. The one place where you have latitude: the `.dc.html` runtime's quirks (see the design's own notes) are prototype workarounds — you do **not** need to reproduce those workarounds, only the visible result they produce.

Per the design owner: **keep the design system exact** (type, color, hero, section rhythm), but the page **composition should be flexible** — that is the point of the section builder. Structure the code so any page body is an ordered list of section blocks that can be reordered/added/removed.

---

## Document map
| File | What's in it |
|---|---|
| `README.md` | This file — overview, stack decision, build order |
| `CLAUDE.md` | **Read first every session** — authoritative design-system baseline + rules |
| `IMPLEMENTATION_BRIEF.md` | Pixel-perfect build directives + screenshot↔source manifest + framework choice |
| `design-tokens.json` | Machine-readable tokens (colors, fonts, layout, motion, commerce) |
| `handoff/screenshots/` | **Permanent visual ground truth** — rendered reference for every screen/state |
| `HANDOFF_CHECKLIST.md` | Pre-flight checklist for picking this up in a real build |
| `01_ARCHITECTURE.md` | Next.js App Router structure, stack, **commerce + CMS recommendation**, data flow |
| `02_DESIGN_TOKENS.md` | Exact colors, type scale, fonts, spacing, the Tailwind theme config, light/dark |
| `03_PAGES_AND_COMPONENTS.md` | Per-page specs: layout, components, copy, states, responsive |
| `04_CHROME.md` | Header, nav, mega-menu, drawer, search overlay, bag drawer, footer |
| `05_SECTION_BUILDER.md` | The drag-and-drop page builder: data model, block registry, editor UX, CMS mapping |
| `MODULE_MAP.md` | Section Library module # → React block + variant (the porting bridge) |
| `starter/` | **Runnable Next.js + Tailwind + Sanity scaffold** implementing all of the above — see `starter/README.md` |
| `design_files/` | The HTML prototypes + reusable JS (`mg-catalog.js`, `mg-bag.js`) + SVG logos + `images/` |

> **Want to start coding immediately?** `cd starter && npm install && npm run dev` — it boots on demo data (no CMS/commerce keys needed) with the design system, chrome, section builder, all pages, the ported 16-product catalog, and a working local cart/checkout already wired. `starter/README.md` explains what to build next and how to connect Sanity + Shopify.

---

## Recommended stack (confirmed)
- **Next.js (App Router) + React + TypeScript + Tailwind CSS.**
- **CMS: Sanity** — chosen because its portable/array content model maps 1:1 onto the section-builder requirement (a page = an ordered array of typed blocks), and it handles the editorial article system well. See `01` and `05`.
- **Commerce: recommendation with options** — see the decision box below and `01_ARCHITECTURE.md §Commerce`.

### Commerce — my recommendation (you asked me to advise)
The prototype uses a **localStorage-only demo cart** (`mg-bag.js`) with no real checkout. For production you have three sensible paths:

1. **Shopify (headless / Storefront API) — recommended.** Keep the entire MG design; use Shopify only as the catalog + cart + checkout backend via the Storefront GraphQL API (or Hydrogen React utilities within Next.js). You get real inventory, payments, taxes, and a hosted PCI-compliant checkout with almost no backend to maintain. The existing `MGBag` interface becomes a thin adapter over a Shopify cart. **Best effort-to-value for a brand this size.**
2. **Stripe + custom cart.** Keep `mg-bag.js`'s model as a real client store, add a Next.js route handler that creates a **Stripe Checkout Session** from the cart. More control over the checkout UI (you can keep the custom 4-step checkout as a pre-payment flow), but you own inventory, taxes, and order records yourself.
3. **Keep the localStorage demo (MVP only).** Fine for a design/marketing launch with "coming soon" commerce, but not a real store. Only pick this to ship the editorial site first and add commerce later.

**Suggested plan:** build the editorial site + section builder first with the cart as a client store (path 3's code), architected behind a `CartProvider` interface so you can drop in Shopify (path 1) without touching UI. `01_ARCHITECTURE.md` shows that seam.

### CMS — my choice (you asked me to decide)
**Sanity.** Rationale: the section builder needs an ordered array of heterogeneous blocks with per-block fields — Sanity's array-of-objects + the Presentation/visual-editing tooling is the most direct fit, and its GROQ queries + Next.js integration are mature. Articles, category intros, product editorial copy, and the homepage all become documents with a shared `sections[]` field. Alternative if the team already knows it: Contentful (same shape, "references to entries"). MDX-in-repo was considered and rejected because it can't power a non-technical drag-and-drop builder.

---

## Suggested build order
1. **Foundation** — Next.js + Tailwind theme from `02_DESIGN_TOKENS.md` (fonts, colors, light/dark via `data-mgtheme` or Tailwind `dark:`). Get one static page rendering with correct type + color.
2. **Chrome** — Header, footer, drawer, search, theme toggle (`04_CHROME.md`). Everything else nests inside this.
3. **Section component library** — build the section blocks as React components with a typed props contract (`05_SECTION_BUILDER.md §Block registry`). This is the heart of the site.
4. **Pages** — assemble Homepage, Category, About, Membership from section blocks (`03`).
5. **Article system** — the template-driven editorial pages (`03 §Article`).
6. **Store** — port `mg-catalog.js` data + `mg-bag.js` model into a `CartProvider`; build Shop/Product/Bag/Checkout (`03 §Store`). Wire commerce backend per the decision above.
7. **Section builder editor** — the drag-and-drop authoring UI + CMS schema (`05`).

---

## Assets
- `design_files/mg-logo.svg` — white MG monogram (SVG). Note: clip rects carry top headroom so the "G" doesn't clip — keep as-is.
- `design_files/mg-logo-wide.svg` — full wordmark.
- `design_files/images/` — 7 in-use photographs (`hero-cover.jpg` Aston Martin, `style-mono.jpg`, `grooming.jpg`, `watch-gear.jpg`, `film-workshop.jpg`, `film-tailor.jpg`, `film-watchmaker.jpg`). These are placeholders/reference; production imagery should come through the CMS/Shopify. Replace before launch or confirm rights.
- Fonts are Google Fonts + a system Futura stack — see `02`.

## What's intentionally NOT included
- The `.dc.html` custom runtime (`support.js`) and `image-slot.js` — prototype-only.
- Any real backend, payment keys, or CMS project — you set those up.
- Production photography rights — confirm before launch.
