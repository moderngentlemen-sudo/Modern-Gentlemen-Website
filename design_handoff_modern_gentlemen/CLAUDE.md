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
| `--mg-accent` (fill) | `#C8102E` | `#C8102E` |
| `--mg-accent-ink` (text) | `#C8102E` | `#f7142e` |
| `--mg-accent-serif` | `#C8102E` | `#ff4d5e` |

- Default theme **light**; boot before paint (inline script) to avoid flash.
- `[data-darkband]` regions stay dark in both themes (hero scrims, red CTA bands): pin `--mg-fg:#f4f4f4; --mg-bd:#ffffff`.
- ⚠️ **Muted text is NOT `color-mix(in srgb, var(--mg-fg) N%, transparent)` — this line said so and was wrong.** `--mg-muted` and `--mg-faint` are four discrete values (`#5a5a5a` / `#707070` in light, `rgba(244,244,244,0.5)` / `rgba(244,244,244,0.5)` in dark). ⚠️ **All four moved for AA**: light was `#8a8a8a` / `#b0b0b0` and dark's faint was `0.35`. **The light ramp kept both steps**, contrary to what this file and `PROGRESS.md` each asserted three times — "both need `#707070`, so AA collapses two steps into one" assumed moving each to the *minimum* passing value, when in fact anything **at or below** `#707070` clears 4.5 on both light grounds, so keeping muted darker preserves a real ramp (the step narrows from 0.180 to 0.060 in luminance, but it survives), and `starter/app/globals.css:13-14` says why: "Flat greys in light, translucent paper in dark — not opacities of `--mg-fg`." The implementation won this disagreement long ago; the doc is only now catching up.
- Footer is **always dark**, not theme-reactive.

> ⚠️ **The accent is TWO tokens now, and the split is the AA fix.** `--mg-accent`
> is the racing red as a **fill** — buttons, the CTA band, badges, borders — and
> is unchanged at `#C8102E` in all three contexts. `--mg-accent-ink` is the red
> as **text**, and it is `#f7142e` in dark contexts because `#C8102E` reads only
> 3.30 on `#0d0d0d`. Every `text-`side use is `text-mg-accentInk`; `bg-`,
> `border-` and `ring-` stay on `mg-accent`.
>
> **Why two rather than one brighter red**, recorded because the obvious repair
> was tried and measured: brightening `--mg-accent` itself took the failing-node
> count from **34 to 46**. The red CTA band is the same token, so lifting its
> luminance dropped the white text sitting on it from 5.88 to 4.12. Ink and fill
> want opposite directions. And no single value can serve both themes either —
> against `#0d0d0d` AA sets a luminance floor of 0.193, against `#f4f4f4` a
> ceiling of 0.162, and those windows do not overlap **for any hue**, not just
> for red.
>
> **The colour tokens are editable data since Phase 6b.** `/admin/theme` writes them to `theme_settings` and `app/layout.tsx` emits them as a `<style>` block over the defaults above. The values in this table remain the baseline and the fallback — they are what a fresh database is seeded with and what the site serves when nothing is published — so this table is still authoritative about what the design *is*. Three additions it now needs: `--mg-accent-rgb` (`200 16 46`), the same red in channels, because Tailwind cannot compute an alpha from a bare `var()`; **`--mg-accent-serif-rgb`, the same twin for the serif accent** (`255 77 94` dark and in a dark band, `200 16 46` light) — added because `mg.accentSerif` was a bare `var()` and all fifteen of its alpha utilities compiled to **no CSS at all**; and `--mg-band-border` / `--mg-muted` / `--mg-faint`, which were always in `globals.css` and never in this table. ✅ ~~`fg`, `bd` and `bg` are still bare `var()` and still broken the same way, across 417 usages~~ — **fixed.** All four of `bg`, `fg`, `surface` and `bd` now carry `--mg-*-rgb` twins in every context, so their ~413 alpha utilities emit CSS at last. `muted` and `faint` stay bare `var()` **deliberately and permanently**: they are `rgba()` in dark, a channel twin can only be derived from a hex, and nothing uses them with an alpha (asserted, not assumed). See `02_DESIGN_TOKENS.md`.
>
> **Typography, layout roles and header behavior are editable in the same document since 2026-08-30.** The default role map is still the table below — Space Grotesk for body/headings, Instrument Serif for editorial accents, IBM Plex Mono for labels and the Futura stack for navigation — so publishing an untouched theme is a visual no-op. The built-in library is a curated set of bundled and platform-safe stacks. Theme payload v5 permits up to twelve named webfonts, plus the standard content width and desktop/mobile gutters. A webfont is either an HTTPS provider stylesheet or a direct WOFF/WOFF2/TTF/OTF file, with an explicit fallback category, weight and style. Roles reference a font by its stable id; raw CSS is never accepted. Header defaults remain the verified 72px transparent-to-frosted, hide-on-scroll design; the editor may change height, scroll/background behavior, search/theme controls, bag visibility, scale, optional compact-on-scroll behavior, divider, icon bubbles and icon hover. Existing v1–v4 payloads acquire the new defaults on read without a migration. Individual builder sections may also carry bounded responsive visual design; absent settings add no wrapper and therefore preserve the verified DOM. The Claude tweak inventory and staged implementation contract live in `BUILDER_ENGINE.md`; never expose a tweak before its renderer behavior exists.

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
Focus traps in drawer/search/bag overlays; `aria-expanded` on menu triggers; Esc closes; visible focus rings; alt text on all images; reduced-motion gating. **All of that is now enforced** by `starter/tests/a11y/` (`npm run test:a11y`) rather than asserted here — **27 tests** (28 until the `KNOWN GAP` contrast test earned its deletion), axe-core over every public route in both themes plus the overlays' keyboard behaviour.

> ⚠️ **SUPERSEDED: "Meet AA contrast — the tokens above already do" was measured and is false.** That sentence stood unchecked from Track A until the a11y pass ran axe against rendered pixels, and it found **204 contrast violations** — every one a token or the brand accent at a size this document specifies, not a scattered mistake. The worst: `#696969` on `#0d0d0d` at **3.54**, the brand red `#c8102e`/`#ff4d5e` at **2.94–3.3**, and `--mg-muted`/`--mg-faint` as low as **1.97**, against a 4.5 requirement.
>
> **This is an open decision, not a defect to quietly fix** — but it is a **much smaller** one than it was, and one sentence of it was wrong. **81% of those violations were never a token change at all**: 128 were `text-[#f4f4f4]/40` on the dark band (three call sites) and 14 were `text-white/75`–`/80` on the red CTA band. Raising those opacity steps fixed them, and **all sixteen baselines passed unmoved** — so *"changing the tokens or the sizes they are used at invalidates the sixteen baselines by construction"* was a deduction rather than a measurement, and the measurement disagrees.
>
> ✅ **This is closed. The measured count is now ZERO** — every WCAG A/AA rule, `color-contrast` included, passes on all 11 public routes in both themes, with no exceptions list and no disabled rules. The path was 204 → 175 → 34 → 6 → **110** → 0.
>
> ⚠️ **The 110 is not a typo and is the most useful number here.** ~413 `text-mg-fg/NN` classes had been compiling to nothing, so muted text painted at **full strength** — which passed contrast by accident. Repairing the alpha utilities made the site look as designed and **took the failures from 6 to 110**, because the bug had been hiding every one of them. **A bug can flatter an audit**; the audit was measuring a site that was not rendering its own design. The floor is arithmetic — `--mg-fg` needs alpha **0.59** to clear 4.5 on `#f4f4f4` — so 177 call sites below `/60` were raised to it.
>
> ⚠️ **The prototypes and this token table contradicted each other, and that is worth keeping.** This table has always said the serif accent is `#C8102E` on light; the `design_files/*.dc.html` prototypes hard-code `color:#ff4d5e` inline with no theme scoping, and the components copied them faithfully. The table won, because `#ff4d5e` on `#f4f4f4` is 2.94 and `#c8102e` is 5.35. **A prototype is a rendering of one theme; this table is the rule.**
>
> ✅ **The light grey ramp is done too, and it did NOT collapse.** `#5a5a5a` / `#707070`, both steps intact — see the note under the token table for why the "it must collapse" claim was wrong. The dark ramp needed no restructuring either: its steps are separate alphas, so raising faint to 0.5 kept both.
>
> ✅ **`ACCEPTED_CONTRAST_GAPS` is gone and so is the `KNOWN GAP` test that watched it** — that was the retirement condition written into the test itself. `color-contrast` is now enforced on every route with **no exceptions**. ⚠️ **If a pair ever has to be excepted again, reinstate a named list rather than reaching for `disableRules`**: a blanket exclusion makes a *new* contrast bug invisible, which this codebase learned once already. See the decisions log in `/PROGRESS.md`.

## Rules for changes
- **Builder-platform compatibility is a governing rule.** The admin editor,
  stored document model and renderer may be changed extensively to gain more
  creative control, better design tools or better performance, but the result
  must still reproduce every existing site design, block, responsive behaviour
  and public function. Existing high-fidelity sections remain supported as
  reusable components even as lower-level layout elements are added. A removal
  requires an explicit content migration, a compatibility renderer and visual
  proof; deleting both a manifest and its component is not a migration.
- **Native elements and responsive visibility are additive platform features.**
  Heading, Text, Image, Video, Embed, Icon, Product, Form, Button, Divider and Spacer are available as low-level
  blocks beside the existing high-fidelity sections. Global hide removes a
  block from public output; device visibility uses the accepted 680/1024
  builder breakpoints and must not introduce layout geometry of its own.
- **Public forms are an anonymous write boundary, not a demo interaction.** The
  Form element posts only bounded scalar fields to `/api/forms`; the service
  consumes both caller and global database rate limits, treats its honeypot as
  indistinguishable success, and writes through the anonymous Supabase client.
  `form_submissions` grants anonymous INSERT without SELECT. Do not replace this
  path with a service-role client or return storage details to the browser.
- **Multi-selection and precise positioning remain bounded data.** The
  store keeps `selectedKey` as the active element and `selectedKeys` as the ordered
  group; group mutations are one undo entry and skip locked elements. Exact
  sizes and offsets are finite bounded numbers in `VisualStyle`, never CSS
  strings. Unset values must emit nothing so the compatibility renderer remains
  a literal no-op for existing content.
- **Rich editorial text remains string-compatible and safe by construction.**
  The manifest rich-text control writes a bounded Markdown subset and previews
  the same semantic React renderer used publicly. Existing plain strings retain
  their paragraph and line-break behavior; raw HTML is never interpreted, and
  user-authored links must pass the renderer's explicit safe-scheme allowlist.
- **Article featured media is versioned presentation data.** Cover/poster images
  retain the article column foreign key; the selected image/GIF/video/embed or
  ordered gallery lives under `hero.featuredMedia`, with the legacy `videoUrl`
  mirrored for old Film Feature rendering. Public embeds are restricted to
  HTTPS YouTube/Vimeo player URLs. Asset ids and URLs must agree with the media
  catalogue before a usage record is accepted.
- **Public template assignments preserve a fixed compatibility path.** Page,
  category, article and product templates compose builder trees; shop, header
  and footer templates insert their existing interactive composition at the
  marker. With no published assignment the verified original route and chrome
  render unchanged.
- No resizing, merging, simplifying, or cleaning up elements/spacing/components — implement as designed even if non-standard.
- Infer breakpoints only from the prototypes/screenshots — do not invent your own.
  > ⚠️ **One scoped exception, decided deliberately and recorded here rather than only in `PROGRESS.md`.** A **layout/columns block** for the page builder — nesting, column widths and their responsive behaviour — **may define its own breakpoints**, because the handoff bundle contains no layout primitive to infer them from. `05_SECTION_BUILDER.md` says the renderer "just stacks" blocks, so there is nothing to copy; building it means inventing, and that has been accepted as the cost of an arbitrary-nesting layout engine.
  >
  > **The exception is narrow.** It covers builder layout primitives (`columns`,
  > `container`, `stack` and future equivalents) and nothing else, and those
  > primitives reuse the site's 680/820/1024 breakpoints rather than inventing
  > another responsive vocabulary. The tokens, the type scale, the 1320px
  > column, the motion timings and every existing component stay exactly as
  > specified — and the sixteen baselines in `handoff/screenshots/` remain the
  > gate, so anything already rendering must still render byte-identically.
  >
  > This note lives beside the rule it modifies on purpose: an override recorded somewhere else is not an override, it is a contradiction the next session has to adjudicate. See the decisions log in `/PROGRESS.md` for the reasoning.
- After building each screen, screenshot your output and diff against `handoff/screenshots/`; fix pixel differences before moving on.
- One section block = one component with a tight prop contract; variants via a `variant` prop (see `MODULE_MAP.md`).
