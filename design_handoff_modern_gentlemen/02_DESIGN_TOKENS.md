# 02 — Design Tokens

Exact values, lifted from the prototype design system. Set these as the single source in Tailwind + CSS variables.

## Color
| Token | Light | Dark | Use |
|---|---|---|---|
| `--mg-bg` | `#f4f4f4` | `#0d0d0d` | Page background |
| `--mg-fg` | `#141414` | `#f4f4f4` | Primary text |
| `--mg-surface` | `#ffffff` | `#131315` / `#161618` | Cards / panels |
| `--mg-bd` | `#141414` | `#ffffff` | Borders |
| `--mg-accent` | `#C8102E` | `#C8102E` | Racing-red accent (CTAs, underlines, labels) |
| `--mg-accent-serif` | `#C8102E` | `#ff4d5e` | Brighter red for serif accents on dark |

- **Default theme is light.** Dark regions that must stay dark in both themes (hero scrims, red CTA bands) are marked `data-darkband` in the prototype — in React, wrap them in a `<DarkBand>` that pins `--mg-fg:#f4f4f4; --mg-bd:#ffffff` regardless of theme.
- ⚠️ **Muted text is NOT a `color-mix` of `--mg-fg`, and this line used to say it was.** The implementation settled on four discrete values, and `starter/app/globals.css:13-14` states why: "Flat greys in light, translucent paper in dark — not opacities of `--mg-fg`." Those values are `--mg-muted` `#8a8a8a` / `rgba(244,244,244,0.5)` and `--mg-faint` `#b0b0b0` / `rgba(244,244,244,0.35)` (light / dark). A ramp derived from `--mg-fg` does not reproduce them.
- Keep whites/blacks subtly toned (they already are). Don't introduce new saturated colors beyond the red.

### CSS-variable setup
```css
:root { --mg-bg:#0d0d0d; --mg-fg:#f4f4f4; --mg-surface:#131315; --mg-bd:#ffffff; --mg-accent:#c8102e; --mg-accent-rgb:200 16 46;
        --mg-accent-serif:#ff4d5e; --mg-accent-serif-rgb:255 77 94;
        --mg-muted:rgba(244,244,244,0.5); --mg-faint:rgba(244,244,244,0.35); --mg-band-border:rgba(255,255,255,0.12); }
html[data-mgtheme="light"] { --mg-bg:#f4f4f4; --mg-fg:#141414; --mg-surface:#ffffff; --mg-bd:#141414;
        --mg-accent-serif:#c8102e; --mg-accent-serif-rgb:200 16 46;
        --mg-muted:#8a8a8a; --mg-faint:#b0b0b0; --mg-band-border:transparent; }
```
Then in Tailwind reference them (`bg-[var(--mg-bg)]`) or map to theme colors (below).

**`--mg-accent-rgb` is the same red in `R G B` channels**, added when the theme editor made the accent editable. Tailwind cannot compute an alpha from a colour whose value is `var(--x)` — it drops the utility entirely — so `mg.accent` maps to `rgb(var(--mg-accent-rgb) / <alpha-value>)` and the ~21 `bg-mg-accent/5`-style utilities keep working. `--mg-accent` stays a hex for the three raw `var(--mg-accent)` uses in `globals.css`. The theme editor derives one from the other, so they cannot drift.

**`--mg-accent-serif-rgb` is the second such twin, and it was added to fix a bug this document previously helped cause.** `mg.accentSerif` was mapped to a bare `var(--mg-accent-serif)` — the exact form the paragraph above warns about — so **all fifteen `mg-accentSerif/NN` utilities compiled to no CSS at all**: every admin error border and tint, the builder's invalid-block frame, the danger Button and Badge, and the sign-in and forgot-password error boxes. Nothing failed, because a border that is absent looks like a design that never had one. Unlike the accent, the serif accent **changes per context**, so the twin is redeclared everywhere `--mg-accent-serif` is — `:root`, the light theme and `[data-darkband]`.

⚠️ **The rule generalises, and three tokens still break it.** `fg`, `bd` and `bg` are declared as bare `var()` and carry **417 alpha usages across 129 files** that have never emitted a single rule — every `text-mg-fg/70` on the public site paints at full opacity today, and the sixteen baselines were captured that way. Repairing it is a visible, site-wide change to a pixel-verified design and is therefore the brand's call; it is held as a `KNOWN GAP` in `starter/lib/domain/alphaUtilities.test.ts`, which also **fails any *new* alpha-modified token declared as a bare `var()`**. See the decisions log in `/PROGRESS.md`.

Three token facts the table above does not carry, all load-bearing:
- `--mg-accent` is the **only** token never overridden — same value in light, dark and inside a dark band.
- `--mg-band-border` is deliberately **absent** from `[data-darkband]`: the hairline is keyed off the *page* theme, so a dark band on a light page still takes no hairline.
- `--mg-surface` genuinely differs inside a band (`#161618`) from `:root` (`#131315`), which is why the dark-band context is a full set of values rather than a delta.

## Typography
Four families, each with a fixed role:
| Family | Role | Source |
|---|---|---|
| **Space Grotesk** | Headings + body | Google Fonts |
| **Instrument Serif** (italic) | Eyebrows, editorial accents, pull quotes | Google Fonts |
| **IBM Plex Mono** | Labels, meta, counts, spec keys | Google Fonts |
| **Futura** stack | Nav items | System: `Futura, "Century Gothic", "Trebuchet MS", sans-serif` |

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Instrument+Serif:ital@1&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```
In Next.js prefer `next/font/google` for Space Grotesk, Instrument Serif, IBM Plex Mono; Futura stays a system stack.

**Conventions**
- Eyebrows / kickers: Instrument Serif italic, often in accent red.
- Labels, result counts, spec keys, prices-as-meta: IBM Plex Mono, uppercase, letter-spaced.
- Headlines: Space Grotesk, tight leading, `text-wrap: balance`; body `text-wrap: pretty`.
- **Minimum body size 16px.** Slide/hero display type is large — match the prototype.

## Layout width
- Content column capped at **1320px**, centered. In the prototype: `padding: … max(48px, calc((100% - 1320px)/2))` on sections — do **not** also set `max-width` on the same element (double-constrains). In Tailwind, a `.container-mg` utility: `w-full px-[max(48px,calc((100%-1320px)/2))]`, or a centered `max-w-[1320px] mx-auto px-12` wrapper — pick one convention and keep it.
- **Full-bleed bands** (heroes, CTA bands, some section backgrounds) go edge-to-edge; only their inner content is capped.
- Store pages historically support a **narrower** variant (1320 → legacy inner max; checkout 1160). Expose as a per-page layout option if desired; not required.

## Spacing & radius
- Spacing follows an 8px rhythm; section vertical padding is generous (editorial). Match the prototype per section rather than forcing a single scale.
- Border radius is **minimal** — this is a sharp, editorial aesthetic. Most cards/buttons are square or lightly rounded. Do not round aggressively.
- Buttons: solid red or outline; uppercase mono or grotesk label; generous horizontal padding. Copy exact treatments from `design_files`.

## Motion
- Red animated underline on nav + drawer links, sitting **6px below** the text (`padding-bottom:6px`).
- Nav: transparent → frosted (backdrop blur) on scroll/hover.
- Overlays (search, drawer, bag) fade/slide in ~260ms; respect `prefers-reduced-motion`.
- Hero + MG Film sections have scroll-triggered video autoplay — gate behind reduced-motion and intersection observers.

## Suggested Tailwind theme extension
```js
// tailwind.config.js (excerpt)
theme: { extend: {
  colors: {
    mg: {
      bg: 'var(--mg-bg)', fg: 'var(--mg-fg)', surface: 'var(--mg-surface)',
      bd: 'var(--mg-bd)',
      // ⚠️ Both accents MUST be channel form — a bare `var()` makes every
      // `/NN` alpha utility compile to nothing, silently. See the note above.
      accent: 'rgb(var(--mg-accent-rgb) / <alpha-value>)',
      accentSerif: 'rgb(var(--mg-accent-serif-rgb) / <alpha-value>)',
    },
  },
  fontFamily: {
    grotesk: ['var(--font-space-grotesk)','sans-serif'],
    serif: ['var(--font-instrument-serif)','serif'],
    mono: ['var(--font-ibm-plex-mono)','monospace'],
    nav: ['Futura','"Century Gothic"','"Trebuchet MS"','sans-serif'],
  },
  maxWidth: { content: '1320px' },
}}
```
