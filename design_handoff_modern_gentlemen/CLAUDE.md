# CLAUDE.md — Modern Gentlemen

> Authoritative baseline for this project. Every color, token, font, spacing value, and component below is the **source of truth**. Do not deviate, simplify, or "improve" — match the handoff bundle and the reference screenshots in `handoff/screenshots/` exactly. When making any future change, keep it consistent with these tokens.
>
> **⚠️ SUPERSEDED (data layer only):** the "Framework decision" line below says CMS = Sanity, commerce = Shopify. That is no longer the plan — the backend is now **Supabase for everything + Stripe for payments** (see **`06_SUPABASE.md`** and `/EXECUTION_PLAN.md §0`). All the design-token / layout / motion / commerce-rule content in this file is unchanged and still authoritative.

## What this project is
Modern Gentlemen — a men's editorial + lifestyle brand (style, grooming, watches, culture, film) with an integrated store. Dark, editorial, luxury-automotive aesthetic. Racing-red accent, monochrome photography, serif/mono/grotesk type mix. **Default theme is light**; persistent light/dark toggle in the header.

## Source of truth, in priority order
1. `handoff/screenshots/` — rendered visual ground truth (keep permanently; never delete).
2. `design_files/*.dc.html` — the high-fidelity prototypes (exact layout, copy, behavior).
3. `02_DESIGN_TOKENS.md` + `design-tokens.json` — extracted tokens.
4. `01`–`05` + `MODULE_MAP.md` — architecture, pages, chrome, section builder.
5. `starter/` — runnable Next.js + Tailwind scaffold implementing all of the above.

## Framework decision
**Next.js (App Router) + React + TypeScript + Tailwind CSS**, CMS = **Sanity**, commerce = **Shopify headless (recommended)** behind a swappable `CartProvider`. Rationale in `01_ARCHITECTURE.md`. The `starter/` folder is already set up this way — build there.

## Design tokens (do not change)
### Color (CSS variables, keyed off `html[data-mgtheme]`)
| Token | Light | Dark |
|---|---|---|
| `--mg-bg` | `#f4f4f4` | `#0d0d0d` |
| `--mg-fg` | `#141414` | `#f4f4f4` |
| `--mg-surface` | `#ffffff` | `#131315` |
| `--mg-bd` | `#141414` | `#ffffff` |
| `--mg-accent` | `#C8102E` | `#C8102E` |
| `--mg-accent-serif` | `#C8102E` | `#ff4d5e` |

- Default theme **light**; boot before paint (inline script) to avoid flash.
- `[data-darkband]` regions stay dark in both themes (hero scrims, red CTA bands): pin `--mg-fg:#f4f4f4; --mg-bd:#ffffff`.
- ⚠️ **Muted text is NOT `color-mix(in srgb, var(--mg-fg) N%, transparent)` — this line said so and was wrong.** `--mg-muted` and `--mg-faint` are four discrete values (`#8a8a8a` / `#b0b0b0` in light, `rgba(244,244,244,0.5)` / `rgba(244,244,244,0.35)` in dark), and `starter/app/globals.css:13-14` says why: "Flat greys in light, translucent paper in dark — not opacities of `--mg-fg`." The implementation won this disagreement long ago; the doc is only now catching up.
- Footer is **always dark**, not theme-reactive.

> **The colour tokens are editable data since Phase 6b.** `/admin/theme` writes them to `theme_settings` and `app/layout.tsx` emits them as a `<style>` block over the defaults above. The values in this table remain the baseline and the fallback — they are what a fresh database is seeded with and what the site serves when nothing is published — so this table is still authoritative about what the design *is*. Two additions it now needs: `--mg-accent-rgb` (`200 16 46`), the same red in channels, because Tailwind cannot compute an alpha from a bare `var()`; and `--mg-band-border` / `--mg-muted` / `--mg-faint`, which were always in `globals.css` and never in this table. See `02_DESIGN_TOKENS.md`.

### Typography
| Family | Role |
|---|---|
| Space Grotesk (300–700) | Headings + body |
| Instrument Serif (italic) | Eyebrows, editorial accents, pull quotes |
| IBM Plex Mono (400/500) | Labels, meta, counts, spec keys — uppercase, letter-spaced |
| Futura stack | Nav items — `Futura, "Century Gothic", "Trebuchet MS", sans-serif` |

Headlines: tight leading, `text-wrap: balance`; body `text-wrap: pretty`. Min body 16px.

### Layout
- Content column capped **1320px**, centered: `padding-inline: max(48px, calc((100% - 1320px)/2))`. Never also set `max-width` on the same element.
- Full-bleed bands go edge-to-edge; only inner content is capped.
- Checkout inner column ~1160px.
- 8px spacing rhythm; **minimal border radius** (sharp editorial look — do not round aggressively).

### Motion
- Red animated nav/drawer underline, 6px below text (`padding-bottom:6px`).
- Nav transparent → frosted (backdrop-blur) on scroll/hover.
- Overlays (drawer/search/bag) fade/slide ~260ms.
- Top vignette scrim: fixed, 85px, `linear-gradient(180deg, rgba(8,8,9,0.34), rgba(8,8,9,0.14) 52%, transparent)`.
- **Respect `prefers-reduced-motion`** on all animation (hero video, scroll triggers, overlay transitions).

## Commerce rules (exact)
Member discount **15%**; free shipping **≥ £50** else **£4.95**; qty `0` removes. localStorage keys owned: `mg-bag`, `mg-member`, `mg-theme` — never clear keys you don't own.

> **⚠️ SUPERSEDED (location only, since Phase 7b):** the 16-product catalog is no longer read from `starter/lib/catalog.ts` at runtime. The store renders from Supabase (`products` + `product_media`, via `lib/services/publicCatalog.ts`); the ported array now lives at `starter/lib/demo/catalog.ts` and is the **seed source and test fixture**. The commerce *rules* above are unchanged and still authoritative — and note they are now enforced in integer pence by `lib/domain/pricing.ts`, not in pounds.

## Accessibility (WCAG 2.2 AA — without altering visuals)
Focus traps in drawer/search/bag overlays; `aria-expanded` on menu triggers; Esc closes; visible focus rings; alt text on all images; reduced-motion gating. Meet AA contrast — the tokens above already do; verify any new combinations.

## Rules for changes
- No resizing, merging, simplifying, or cleaning up elements/spacing/components — implement as designed even if non-standard.
- Infer breakpoints only from the prototypes/screenshots — do not invent your own.
- After building each screen, screenshot your output and diff against `handoff/screenshots/`; fix pixel differences before moving on.
- One section block = one component with a tight prop contract; variants via a `variant` prop (see `MODULE_MAP.md`).
