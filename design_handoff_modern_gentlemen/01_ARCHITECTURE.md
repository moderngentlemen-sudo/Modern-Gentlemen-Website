# 01 — Architecture

> **⚠️ SUPERSEDED (data layer):** the Sanity + Shopify recommendation below is no longer the plan. The data layer is now **Supabase for everything (content, products, auth/members, orders, newsletter, cart, storage) + Stripe for payments.** See **`06_SUPABASE.md`** and `/EXECUTION_PLAN.md §0`. The folder-structure, theme, and accessibility guidance here still applies; ignore the Sanity/Shopify specifics.

## Stack
- **Next.js (App Router) + TypeScript** — SSR/SSG for editorial SEO, route handlers for commerce.
- **React + Tailwind CSS** — see `02_DESIGN_TOKENS.md` for the theme config.
- **Sanity** — headless CMS (content + the section builder).
- **Commerce backend** — Shopify Storefront API recommended; abstracted behind a `CartProvider` (see below).

## Suggested folder structure
```
app/
  layout.tsx                 # <html data-mgtheme>, fonts, ThemeProvider, CartProvider, Header, Footer
  page.tsx                   # Homepage — renders <SectionRenderer sections={home.sections}/>
  (editorial)/
    [category]/page.tsx      # Category landing (style|grooming|watches|culture|film)
    article/[slug]/page.tsx  # Article system (template-driven)
    about/page.tsx
    membership/page.tsx
  (store)/
    shop/page.tsx
    product/[slug]/page.tsx
    bag/page.tsx
    checkout/page.tsx
  api/
    checkout/route.ts        # creates Shopify/Stripe checkout session
components/
  chrome/                    # Header, Nav, MegaMenu, Drawer, SearchOverlay, BagDrawer, Footer, ThemeToggle
  sections/                  # ONE component per section-builder block (see 05)
  sections/registry.ts       # blockType -> component map
  SectionRenderer.tsx        # maps sections[] -> components
  store/                     # ProductCard, Gallery, QtyStepper, OrderSummary, CheckoutSteps
  ui/                        # Button, Eyebrow, Tag, primitives
lib/
  catalog.ts                 # ported from mg-catalog.js (or Shopify data layer)
  cart/                      # CartProvider + adapters (local | shopify)
  sanity/                    # client, queries (GROQ), image url builder
  theme.ts
sanity/                      # Sanity studio schema (optional co-located studio)
```

## Data flow
- **Content** (pages, sections, articles, category intros) → Sanity → GROQ query in server components → typed objects → `<SectionRenderer/>`.
- **Products** → Shopify Storefront API (or ported `catalog.ts` for MVP) → server components for PDP/shop, client for cart interactions.
- **Cart/membership** → `CartProvider` (client context) persisted to localStorage for the local adapter, or synced to a Shopify cart id for the Shopify adapter.

## Theme
Boot theme **before paint** to avoid a flash. In `app/layout.tsx` inject a tiny inline script that reads `localStorage['mg-theme'] || 'light'` and sets `document.documentElement.setAttribute('data-mgtheme', …)`. Default is **light**. Drive colors with CSS variables keyed off `[data-mgtheme]` (see `02`). This mirrors the prototype exactly and is the reliable no-flash pattern.

## Commerce — the CartProvider seam
Define one interface and two adapters so the UI never knows which backend is live:

```ts
// lib/cart/types.ts
export interface CartItem { slug: string; qty: number; /* + variantId for shopify */ }
export interface Cart {
  items: () => EnrichedItem[];          // joined with product data
  count: () => number;
  subtotal: () => number;               // minor units or number, be consistent
  add: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;   // 0 removes
  remove: (slug: string) => void;
  clear: () => void;
  isMember: () => boolean;
  setMember: (v: boolean) => void;
  memberRate: number;                   // 0.15
  checkoutUrl?: () => Promise<string>;  // shopify/stripe hosted checkout
}
```
- **Local adapter** — reimplements `mg-bag.js`: localStorage key `mg-bag` = `[{slug, qty}]`, member flag `mg-member`. Every mutation notifies subscribers (React context does this for free — no manual `mg-bag-change` event needed). Member discount = 15% (`memberRate = 0.15`). Free shipping ≥ £50, else £4.95.
- **Shopify adapter** — `add`/`setQty` call Storefront cart mutations; `checkoutUrl()` returns the hosted checkout URL. The custom 4-step checkout (`03 §Checkout`) either becomes a **pre-checkout** capture that then hands off to Shopify, or is dropped in favor of Shopify's hosted checkout — decide per business need.

> **Never** clear localStorage keys you didn't write; the local adapter owns only `mg-bag` / `mg-member`.

## SEO & rendering
- Editorial pages: static/ISR with generated metadata (title, OG image from CMS hero).
- Product pages: SSR/ISR with product structured data (JSON-LD `Product`).
- Sitemap + robots from route data.

## Accessibility (bring up to standard during rebuild)
The prototype is visual-first. In the rebuild, ensure: focus traps in the drawer/search/bag overlays, `aria-expanded` on menu triggers, ESC to close (already in the design), visible focus rings, `prefers-reduced-motion` gating on the hero/scroll animations, and alt text on all CMS/Shopify images.
