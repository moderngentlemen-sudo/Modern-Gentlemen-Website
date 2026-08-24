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

> **The colour tokens are editable data since Phase 6b.** `/admin/theme` writes them to `theme_settings` and `app/layout.tsx` emits them as a `<style>` block over the defaults above. The values in this table remain the baseline and the fallback — they are what a fresh database is seeded with and what the site serves when nothing is published — so this table is still authoritative about what the design *is*. Three additions it now needs: `--mg-accent-rgb` (`200 16 46`), the same red in channels, because Tailwind cannot compute an alpha from a bare `var()`; **`--mg-accent-serif-rgb`, the same twin for the serif accent** (`255 77 94` dark and in a dark band, `200 16 46` light) — added because `mg.accentSerif` was a bare `var()` and all fifteen of its alpha utilities compiled to **no CSS at all**; and `--mg-band-border` / `--mg-muted` / `--mg-faint`, which were always in `globals.css` and never in this table. ⚠️ `fg`, `bd` and `bg` are still bare `var()` and still broken the same way, across 417 usages — a design decision, not an oversight. See `02_DESIGN_TOKENS.md`.

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
Focus traps in drawer/search/bag overlays; `aria-expanded` on menu triggers; Esc closes; visible focus rings; alt text on all images; reduced-motion gating. **All of that is now enforced** by `starter/tests/a11y/` (`npm run test:a11y`) rather than asserted here — 28 tests, axe-core over every public route in both themes plus the overlays' keyboard behaviour.

> ⚠️ **SUPERSEDED: "Meet AA contrast — the tokens above already do" was measured and is false.** That sentence stood unchecked from Track A until the a11y pass ran axe against rendered pixels, and it found **204 contrast violations** — every one a token or the brand accent at a size this document specifies, not a scattered mistake. The worst: `#696969` on `#0d0d0d` at **3.54**, the brand red `#c8102e`/`#ff4d5e` at **2.94–3.3**, and `--mg-muted`/`--mg-faint` as low as **1.97**, against a 4.5 requirement.
>
> **This is an open decision, not a defect to quietly fix** — but it is a **much smaller** one than it was, and one sentence of it was wrong. **81% of those violations were never a token change at all**: 128 were `text-[#f4f4f4]/40` on the dark band (three call sites) and 14 were `text-white/75`–`/80` on the red CTA band. Raising those opacity steps fixed them, and **all sixteen baselines passed unmoved** — so *"changing the tokens or the sizes they are used at invalidates the sixteen baselines by construction"* was a deduction rather than a measurement, and the measurement disagrees.
>
> **What is genuinely still the brand's call is the red**, and the arithmetic is why: `#c8102e` reads **3.30** on the dark band, and lightening it ~25% toward white reaches 4.69 there while **dropping to 3.77 on the light page**, where it currently passes at 5.35. **No single red clears 4.5:1 at small text in both themes.** Either the accent becomes theme-dependent, or it is reserved for large/non-text use. The other survivor is the light grey ramp: `--mg-muted` and `--mg-faint` both need `#707070`, so AA collapses two steps into one.
>
> It is held as a `KNOWN GAP` characterisation test that asserts today's behaviour and carries the instruction to invert it — the technique that closed `0018` and `0020`. ⚠️ **The per-route audits no longer exclude `color-contrast`**: they enforce it everywhere except eight named colour pairs (`ACCEPTED_CONTRAST_GAPS` in `starter/tests/a11y/public.spec.ts`), each carrying its measured ratio and why it is still there. Blanket exclusion was right while everything failed for one undecided reason, and wrong once the decidable part was fixed — with the rule off, a *new* contrast bug anywhere was invisible. See the decisions log in `/PROGRESS.md`.

## Rules for changes
- No resizing, merging, simplifying, or cleaning up elements/spacing/components — implement as designed even if non-standard.
- Infer breakpoints only from the prototypes/screenshots — do not invent your own.
  > ⚠️ **One scoped exception, decided deliberately and recorded here rather than only in `PROGRESS.md`.** A **layout/columns block** for the page builder — nesting, column widths and their responsive behaviour — **may define its own breakpoints**, because the handoff bundle contains no layout primitive to infer them from. `05_SECTION_BUILDER.md` says the renderer "just stacks" blocks, so there is nothing to copy; building it means inventing, and that has been accepted as the cost of an arbitrary-nesting layout engine.
  >
  > **The exception is narrow.** It covers a new layout block and nothing else. The tokens, the type scale, the 1320px column, the motion timings and every existing component stay exactly as specified — and the sixteen baselines in `handoff/screenshots/` remain the gate, so anything already rendering must still render byte-identically.
  >
  > This note lives beside the rule it modifies on purpose: an override recorded somewhere else is not an override, it is a contradiction the next session has to adjudicate. See the decisions log in `/PROGRESS.md` for the reasoning.
- After building each screen, screenshot your output and diff against `handoff/screenshots/`; fix pixel differences before moving on.
- One section block = one component with a tight prop contract; variants via a `variant` prop (see `MODULE_MAP.md`).
