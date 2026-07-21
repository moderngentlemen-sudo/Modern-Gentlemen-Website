# Reference Screenshots — visual ground truth

**Keep this folder in the repo permanently.** These are the authoritative rendered reference for the Modern Gentlemen build. After building each screen/component, screenshot your output and compare side-by-side against the matching file here; fix pixel differences before moving on (see `../IMPLEMENTATION_BRIEF.md`).

## Capture conditions (important)
- Captured from the source prototypes in `../design_files/` at the design's **light default theme** unless noted.
- Preview width at capture was ~909px CSS px (2x device-pixel-ratio, so PNGs are ~1818px wide). The prototypes render their **desktop** layout at this width (horizontal nav, multi-column grids). The definitive responsive rules live in the prototype media queries at **1024 / 900 / 680px** — read those in the `.dc.html` source for exact breakpoint behavior.
- `<video>` heroes show a dark frame in captures (cross-origin video frames can't be serialized) — the video plays fine in the live prototype; treat the still hero composition as the reference.

## Manifest
| File(s) | Screen / state | Source |
|---|---|---|
| `homepage-desktop.png` | Homepage — hero (top) | Modern Gentlemen Homepage.dc.html |
| `01–04-homepage.png` | Homepage — scrolled sections (latest, features, story band/film, newsletter+footer) | ″ |
| `01–02-store-desktop.png` | Store — grid top + scrolled | MG Store.dc.html |
| `01–03-product-desktop.png` | Product — gallery/details, story, specs+related | MG Product.dc.html |
| `bag-desktop.png` | Bag — line items + summary | MG Bag.dc.html |
| `bag-drawer.png` | Bag drawer — empty state ("BROWSE THE STORE") | MG Header.dc.html |
| `checkout-desktop.png` | Checkout — step 1 + summary rail | MG Checkout.dc.html |
| `01–03-membership-desktop.png` | Membership — hero, tiers, FAQ | MG Membership.dc.html |
| `01–02-category-desktop.png` | Category landing — hero band + content | MG Category.dc.html |
| `01–02-article-desktop.png` | Article — hero + body | MG Article.dc.html |
| `01–02-about-desktop.png` | About — masthead + body | MG About.dc.html |
| `drawer-open.png` | Slide-over drawer (left) — category accordion | Homepage |
| `01–02-search-overlay.png` | Search overlay — empty + grouped results (EDITORIAL / query "watch") | Homepage |
| `02-nav-megamenu.png` | Mega-menu (STYLE) — links + featured card | Homepage |
| `footer.png` | Footer — always-dark, nav + social + legal | MG Footer.dc.html |
| `section-library.png` | Section Library — module picker (top) | Modern Gentlemen Section Library.dc.html |

## Known gaps in this capture set (reproduce from source)
- **Mobile layouts** — the preview pane could not be narrowed below the desktop breakpoint during capture, so dedicated mobile PNGs are not included. Mobile/responsive behavior is fully defined by the media queries in each `.dc.html` (breakpoints 1024 / 900 / 680px) — implement from those and screenshot your own mobile output to verify.
- **Populated bag drawer, checkout confirmation, hover/added button states** — these are transient states best reproduced from the prototype logic (`../design_files/*.dc.html`, `../design_files/mg-bag.js`). The empty bag drawer is captured; the populated layout matches the bag page (`bag-desktop.png`).
