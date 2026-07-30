# 04 — Chrome (Header · Nav · Drawer · Search · Bag · Footer)

The chrome wraps every page. In the prototype it's duplicated across files (an inline copy on the homepage + a shared `MG Header.dc.html` imported by sub-pages); **in React, build it ONCE** as `components/chrome/*` and render it in `app/layout.tsx`. That collapses the prototype's biggest maintenance burden.

Reference files: `design_files/MG Header.dc.html`, `design_files/MG Footer.dc.html`.

---

## Header / fixed nav
Fixed to the top. **Transparent over heroes → frosted (backdrop-blur + subtle bg) on scroll or hover.**

### Hide on scroll
The bar **slides away on scroll-down and returns on scroll-up** (`translateY(-100%)`, 320ms) — the sanctioned motion from `EXECUTION_PLAN.md §10`; it **never resizes**, the 72px height is fixed. Rules (`lib/useHideOnScroll.ts`):
- Never hides in the top **120px** — heroes keep the nav.
- Deltas under **6px** are jitter and change nothing.
- Held visible while the **mega-menu** or any **overlay** is open; overlay scroll-lock/restore moves the document scroll position, so those non-gesture scroll events must re-baseline rather than read as a direction.
- Keyboard focus reaching the chrome reveals it; the global reduced-motion rule collapses the slide to an instant snap.

Three zones:
- **LEFT:** a red square button (opens the slide-over drawer) + the **MG monogram** logo (`mg-logo.svg`).
- **CENTER:** primary menu — `STYLE · GROOMING · WATCHES · CULTURE · FILM · SHOP` — Futura stack, each link with a **red animated underline 6px below the text** (`padding-bottom:6px`, underline grows on hover/active).
- **RIGHT:** icon cluster — **bag** (with red count badge) · **search** · **dark-mode toggle**.

### Top vignette scrim
A `position:fixed`, **85px** tall gradient bar behind the nav at the very top, improving nav legibility over hero photos:
`background: linear-gradient(180deg, rgba(8,8,9,0.34) 0%, rgba(8,8,9,0.14) 52%, transparent 100%)`. Opacity ties to scroll. One instance in React (the prototype has two copies to keep in sync — you won't).

### Mega menu
STYLE / GROOMING / WATCHES / CULTURE open a **full-width frosted dropdown** with links + a featured image. On desktop, open on hover; on touch (`(hover:none) and (pointer:coarse)`), open on tap. (The prototype uses delegated native listeners to work around its runtime not binding `onMouseEnter/Leave` — **you don't need that hack**; use normal React `onMouseEnter/onFocus` + `onClick` for touch, with proper `aria-expanded`.)

---

## Slide-over drawer (left)
Opens from the red square. Contents:
- **Accordion of categories** — each row expands to reveal sublinks (chevron rotates).
- A secondary link row, a **member CTA**, and **social links**.
- Menu-item links use the same red animated underline as the nav (6px below text).
- A configurable **drawer logo** at the top (monogram or wordmark).
- **Closes** on ✕, Esc, or scrim click.

## Search overlay
Full-screen fade-up. Live-filtered as you type. **Results grouped into two sections:**
- **EDITORIAL** — matches from the content index (articles/pages).
- **SHOP** — matches from the product catalog (`lib/catalog.ts` / Shopify); each product row links to the PDP and shows price as meta.
- Each group has a red IBM-Plex-Mono header + a result count.
- A **clear (×)** button sits at the right end of the input.
- Note: the prototype hides the price/meta column ≤680px; in the rebuild you can keep prices visible on mobile if you prefer (it was a space compromise).

## Bag drawer
Opens from the bag icon; slides in from the right. Line items with **qty steppers + remove**, a **member-discount** line, **subtotal**, a **free-shipping-over-£50** note, and **CHECKOUT** + **VIEW FULL BAG** links. Empty state links to the shop. Live via `CartProvider`. Variants exist (slide-in drawer / dropdown under the icon / navigate to full bag page) — expose as a config prop if wanted; default slide-in.

## Overlay behavior (drawer / search / bag)
- **Scroll lock** while open. Use the iOS-safe **fixed-body** technique: on lock save `scrollY`, set body `position:fixed; top:-scrollY; left/right:0; width:100%; overflow:hidden`; on unlock restore and `window.scrollTo(0, savedY)`. Temporarily set `scroll-behavior:auto` during the restore so smooth-scroll doesn't animate a visible bounce. (Prefer a small `useScrollLock` hook.)
- Close on Esc; trap focus inside the overlay; return focus to the trigger on close.
- Only one overlay open at a time.

## Theme toggle
Persists `localStorage['mg-theme']` and sets `document.documentElement[data-mgtheme]`. Default light. Booted before paint (`01 §Theme`). All theme-reactive color comes from CSS vars (`02`), so no per-component logic is needed.

---

## Footer — `MG Footer.dc.html`
**Always dark**, regardless of theme (do not wire it to `data-mgtheme`). Standard editorial footer: brand block, link columns (shop, editorial, company, social), newsletter/legal row. Build once; render in `layout.tsx`.

---

## Configurable chrome options (optional)
The prototype exposes ~25 chrome "tweaks" (burger style, hover styles, nav motion, drawer entry/exit animations, bag style, drawer logo, etc.) for design exploration. **These are exploration knobs, not required product features.** Pick the chosen values from the current prototype state as your defaults and hardcode them; only re-expose a knob if the brand genuinely wants it runtime-configurable. Current canon defaults noted in the prototype: burger = "Sq thin pair", chevron bubbles = off, drawer logo = "Wordmark".
