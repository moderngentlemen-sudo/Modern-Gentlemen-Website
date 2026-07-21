# 03 — Pages & Components

Per-page specs. For exact pixel detail, spacing, and copy, open the matching file in `design_files/`. This document gives layout, behavior, state, and responsive rules. Every page nests inside the shared chrome (`04_CHROME.md`): fixed header + top scrim, footer at the bottom.

Global rules for all pages:
- Page root: `overflow-x: clip`, `overscroll-behavior: none`.
- Content capped to 1320px column (`02`); full-bleed bands go edge-to-edge.
- Fonts, colors, light/dark exactly per `02`.
- Every page body should ultimately be **an ordered array of section blocks** (`05`) so it's editor-composable — even the homepage.

---

## Homepage — `Modern Gentlemen Homepage.dc.html`
The flagship. Body = ordered sections; build each as a registry block (`05`).

**Sections, in order:**
1. **Hero — "Cover Star"** — fixed ~640px GQ-style split: cover photo occupies the right ~54% column, meeting a dark left panel at a 1px divider; an overlapping lower-left headline block sits across the seam. Supports a still image **or** autoplay video (muted, loop, set imperatively via ref — the React `muted` prop is unreliable; set `videoEl.muted = true` before `play()`). Accepts YouTube URL/ID or a direct `.mp4/.webm` (self-hosted is more reliable). **Mobile:** full-bleed image with its own layout/height/text-align settings; a "Fullscreen" height option runs `100svh` behind the header.
2. **The Latest** — 3-column magazine grid of editorial cards (image, category kicker, headline, meta). The prototype carries 30 layout variants — for the rebuild, expose 2–4 meaningful ones as a block prop, not 30.
3. **Style feature** — large feature block (image + editorial text), one of a few layout variants.
4. **Grooming + Watches two-up** — two side-by-side category features.
5. **Story band** — full-bleed editorial statement band.
6. **MG Film** — 3-up video stills; hover shows a preview; the first auto-plays when scrolled into view. Clicking opens a video lightbox (YouTube or file).
7. **Newsletter** — email capture band.
8. **Footer** (chrome).

**State:** theme, scroll position (nav frosting), hero video playing, film hover/lightbox open. **Responsive:** grids collapse to 1–2 cols; hero switches to the mobile layout described above.

---

## Category landing — `MG Category.dc.html`
Reusable section landing keyed by category: **Style / Grooming / Watches / Culture / Film** (prototype reads `?cat=`; in Next use `/[category]`).
- Full-bleed category **hero band** (title + intro) that stays edge-to-edge.
- Editorial content column below (articles/features for that category), optionally narrowed to ~1180px via a layout flag (`narrowLayout` in the prototype) — hero stays full-bleed, only inner content narrows.
- Content comes from the CMS filtered by category.

---

## Article system — `MG Article.dc.html`
Template-driven editorial pages. Prototype reads `?a=slug` and offers **20 hero+body templates** (an enum), persisting the per-article choice to `localStorage['mg-atpl::'+slug]`.
- In production: the **template is a field on the article document** in the CMS (an enum/string), not a client toggle. Render `hero` + `body` variant components off that field. Drop the localStorage persistence — the CMS holds the choice.
- Build the template variants as a small set of hero components (full-bleed, split, centered, etc.) + body layouts. You don't need all 20 up front — implement the ones actually used, extend the enum as needed.
- Body content = portable text (Sanity block content) with inline images/pull-quotes/embeds.

---

## About — `MG About.dc.html`
Masthead/about page: brand statement, masthead/team, editorial imagery. Compose from section blocks. Straightforward static/CMS content.

---

## Membership — "The Debrief" — `MG Membership.dc.html`
- **Billing toggle** (monthly / annual) that switches displayed prices.
- **3 tiers** as pricing cards (name, price, feature list, CTA).
- **FAQ** accordion.
- Membership state ties to the cart's `isMember()` (member pricing = 15% off across the store). Joining sets the member flag (and in production, creates a subscription — Shopify subscriptions or Stripe Billing).

---

## Store

Port `design_files/mg-catalog.js` (data + helpers) into `lib/catalog.ts`, and `design_files/mg-bag.js` (model + rules) into the `CartProvider` (`01`). Product shape:
```
{ slug, cat, catLabel, name, price (GBP int), tag ('NEW'|'BESTSELLER'|'LIMITED'|''),
  material, blurb, story (\n\n-split paras), specs ([key,value][]), images (string[3]) }
```
Catalog helpers to preserve: `all()`, `get(slug)`, `byGroup(group)`, `related(slug,n)`, `groups` (`['All','Style','Watches','Grooming','Accessories']`), `format(n)` → `£1,234`.
Cart rules: member discount **15%**; free shipping **≥ £50** else **£4.95**; qty `0` removes.

### Store — `MG Store.dc.html`
Filter chips synced to category (`?cat=` → query param or route). Product grid of cards → link to PDP. "ADD" adds to cart and the button stays **"ADDED ✓"** for that slug (no revert). A cart-note band reflects live count + subtotal. "VIEW BAG" → bag page.

### Product (PDP) — `MG Product.dc.html`
Editorial PDP. Breadcrumb; **sticky gallery** (main image + clickable thumbnails, selected index in state); title / price / member-price / blurb / material; **qty stepper + ADD TO BAG**; assurances row; **THE STORY** (prose paras); **SPECIFICATIONS** (2-col grid → 1 centered col on mobile); **related** products 4-up.
- ADD TO BAG becomes **"ADDED"** and stays (no revert timer); reset `added` when the slug changes (SPA nav).
- Not-found: only show the not-found state after data resolves (avoid a flash) — in Next, use `notFound()` for unknown slugs at the server.

### Bag — `MG Bag.dc.html`
Two-column: **line items** (image, name → PDP, each-price, qty stepper, remove, line total) + **sticky order summary** (subtotal, member discount, shipping [free ≥£50 else £4.95], total, CHECKOUT, become-a-member CTA, secure note). Empty state links to shop. Collapses to 1 column ≤900px.

### Checkout — `MG Checkout.dc.html`
4 steps: **Contact → Shipping → Payment → Review**, then a **confirmation** screen.
- Clickable step indicator (can jump back to completed steps). Per-step validation → field errors + invalid styling.
- `placeOrder()` builds an order id (`MG-XXXXXX`), clears the cart, shows confirmation. **Payment is a demo** in the prototype ("no real card is charged").
- **Production:** replace the payment step with real payment. Either keep steps 1–3 as data capture then redirect to **Shopify/Stripe hosted checkout** (recommended — PCI handled for you), or integrate **Stripe Elements** into the Payment step for an on-site card form. Do not build a raw card form without a PCI-compliant provider.
- Layout: flex column `min-height:100vh` with the content `flex:1` so the footer sits at the bottom on short states.

### Bag drawer
Lives in the header chrome (`04`) — slide-in from the right with line items, qty steppers, member discount line, subtotal, free-shipping note, checkout + view-full-bag links, empty state. Has display variants (slide-in / dropdown / full-page nav). The bag badge count is live everywhere via `CartProvider`.

---

## Shared UI primitives to build
`Button` (solid-red / outline), `Eyebrow` (serif italic), `Tag` (NEW/BESTSELLER/LIMITED pill), `MonoLabel`, `QtyStepper`, `ProductCard`, `ArticleCard`, `Gallery`, `OrderSummary`, `Accordion`, `Field` (with error state). Reuse across pages.
