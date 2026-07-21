# Implementation Brief — for Claude Code

> Build this exactly as specified. **No creative reinterpretation, simplification, or "improvement."** The prototypes in `design_files/` and the screenshots in `handoff/screenshots/` are the visual ground truth.

## Framework & styling (decided)
**Next.js (App Router) + React + TypeScript + Tailwind CSS.** Chosen because the design is content-driven with an editorial article system and a drag-and-drop section builder — Next's server components + a Sanity page-builder (array of typed blocks) reproduce that faithfully, and Tailwind lets us pin the exact token set from `design-tokens.json`. The `starter/` folder is already scaffolded this way; extend it, don't restart.
- **CMS:** Sanity (array-of-blocks = the section builder). **Commerce:** Shopify headless recommended, behind `lib/cart/` `CartApi`. See `01_ARCHITECTURE.md`.
- **Animation:** CSS transitions/keyframes only (already in `starter/app/globals.css`) — no animation library is implied. Overlays, nav frosting, hover scales. If a richer scroll/video interaction is added, use the native IntersectionObserver + `<video>` pattern already shown in `components/sections/HeroCoverStar.tsx` / `FilmStills.tsx`; do not substitute a heavier lib.
- **Charts:** none in this design.

## Design system
No pre-existing system. Extract everything from the bundle:
- `CLAUDE.md` — the documented baseline (read first, every session).
- `design-tokens.json` — machine-readable tokens.
- `starter/tailwind.config.ts` + `starter/app/globals.css` — the tokens wired into Tailwind + CSS variables.
Keep all future work consistent with these. Do not introduce colors, fonts, or spacing values not derived from them.

## Layout fidelity — hard rules
- Match spacing, alignment, font sizes, component proportions, and responsive behavior **exactly** as in the canvas/preview and screenshots.
- **Infer breakpoints from the prototypes** (`design_files/*.dc.html` media queries) — do not invent your own. Known breakpoints in the prototypes include `1024px`, `900px`, `680px` (and the store grid steps at `1024`/`680`). Confirm per component in the source.
- Do not resize, simplify, merge, or clean up any element, spacing value, or component — implement as designed even if it looks non-standard.

## Accessibility (WCAG 2.2 AA — without changing visuals)
Focus traps in overlays, `aria-expanded` on menu triggers, Esc to close, visible focus rings, alt text on all images, `prefers-reduced-motion` gating. The token contrasts already meet AA; verify any new pairing.

## Self-verification loop (per screen/component)
1. Build it from `design_files/<page>.dc.html` (source of truth for structure/copy — recreate from the code, not by eyeballing the PNG).
2. Render it and screenshot your output.
3. Compare side-by-side against the matching file in `handoff/screenshots/`.
4. Report pixel-level diffs (spacing, alignment, color, type, proportion) and fix before moving on.

## Screenshot manifest → source page
| Screenshot | Source prototype |
|---|---|
| `homepage-desktop.png`, `homepage-mobile.png` | `design_files/Modern Gentlemen Homepage.dc.html` |
| `nav-megamenu.png`, `search-overlay.png`, `drawer-open.png`, `bag-drawer.png` | `design_files/MG Header.dc.html` (+ homepage) |
| `category-desktop.png` | `design_files/MG Category.dc.html` |
| `article-desktop.png` | `design_files/MG Article.dc.html` |
| `about-desktop.png` | `design_files/MG About.dc.html` |
| `membership-desktop.png` | `design_files/MG Membership.dc.html` |
| `store-desktop.png`, `store-mobile.png` | `design_files/MG Store.dc.html` |
| `product-desktop.png` | `design_files/MG Product.dc.html` |
| `bag-desktop.png`, `bag-empty.png` | `design_files/MG Bag.dc.html` |
| `checkout-desktop.png`, `checkout-confirmation.png` | `design_files/MG Checkout.dc.html` |
| `section-library.png` | `design_files/Modern Gentlemen Section Library.dc.html` |
| `footer.png` | `design_files/MG Footer.dc.html` |

## Post-build verification report
After the full implementation, list anything in the bundle or screenshots that was ambiguous, incomplete, or impossible to reproduce exactly, and how you handled it. Keep `handoff/screenshots/` in the repo permanently as visual ground truth.

## Build order
Follow `README.md §Suggested build order`: foundation → chrome → section blocks → pages → article system → store → section-builder editor. `HANDOFF_CHECKLIST.md` is the pre-flight list (accounts, secrets, content, stubbed pieces).
