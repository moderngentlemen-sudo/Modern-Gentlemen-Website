# Verification Report

What was clear, and what was ambiguous / incomplete / impossible to reproduce exactly as-is — and how it was handled. Read alongside `IMPLEMENTATION_BRIEF.md`.

## Fully specified (build with confidence)
- **Design tokens** — colors, fonts, layout width, motion, light/dark. Exact values in `CLAUDE.md` + `design-tokens.json`, wired in `starter/`.
- **Page structure & copy** — every page exists as a high-fidelity prototype in `design_files/*.dc.html`; recreate from that source (not by eyeballing PNGs).
- **Chrome & overlays** — header, mega-menu, drawer, search (grouped EDITORIAL/STORE results), bag drawer, footer — built in `starter/components/chrome/` and captured in screenshots.
- **Commerce rules** — 15% member discount, free shipping ≥£50 else £4.95, qty-0-removes; 16-product catalog ported to `starter/lib/catalog.ts`.

## Ambiguous / incomplete — and how handled
1. **Mobile reference screenshots** — the capture preview could not be narrowed below the desktop breakpoint, so no dedicated mobile PNGs are included. *Handled:* responsive behavior is fully defined by media queries in each `.dc.html` (breakpoints **1024 / 900 / 680px**); build mobile from those and self-verify with your own mobile captures. Do not invent other breakpoints.
2. **Video heroes in captures** — `<video>` frames render dark in screenshots (cross-origin serialization limit). *Handled:* the still hero composition/layout is the reference; video autoplay behavior is documented in `03` + `HeroCoverStar.tsx` (set `muted` imperatively, respect reduced-motion).
3. **Transient states** (populated bag drawer, checkout confirmation, "ADDED ✓" button, field-error styling) — not all captured as PNGs. *Handled:* reproduce from prototype logic in `design_files/*.dc.html` + `mg-bag.js`; the empty bag drawer and the full bag page are captured as the layout reference.
4. **Article templates** — the prototype offers ~20 hero/body variants via a client toggle. *Handled:* in production the variant is a CMS field (`article.template`); build one component per value actually used, extend the enum as needed. Not all 20 are pre-built.
5. **Section Library (~125 modules)** — too many to build 1:1. *Handled:* mapped to ~13 archetype blocks + variants in `MODULE_MAP.md`; the file lists the few remaining TODO archetypes (spec table, membership-tiers block, the 10 showcase "Vogue" heroes to port at full fidelity).
6. **Chrome exploration knobs** — the prototype exposes ~25 configurable chrome tweaks (burger style, animations, etc.). *Handled:* these are exploration knobs, not product features; the current prototype's chosen values are the canon defaults (noted in `04_CHROME.md`) — hardcode them.
7. **Commerce/CMS backends, payments, auth, newsletter** — demo-only in the prototype. *Handled:* documented as swap-in work behind the `CartProvider` seam + Sanity queries; see `HANDOFF_CHECKLIST.md`.

## Nothing was simplified or "improved"
The prototypes' non-standard spacing, sharp radii, and layout choices are intentional and preserved. Implement as designed.
