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
- Muted text in the prototype = `color-mix(in srgb, var(--mg-fg) XX%, transparent)`. Reproduce with Tailwind opacity utilities on the fg color, or keep the `color-mix` approach.
- Keep whites/blacks subtly toned (they already are). Don't introduce new saturated colors beyond the red.

### CSS-variable setup
```css
:root { --mg-bg:#0d0d0d; --mg-fg:#f4f4f4; --mg-surface:#131315; --mg-bd:#ffffff; --mg-accent:#C8102E; --mg-accent-serif:#ff4d5e; }
html[data-mgtheme="light"] { --mg-bg:#f4f4f4; --mg-fg:#141414; --mg-surface:#ffffff; --mg-bd:#141414; --mg-accent-serif:#C8102E; }
```
Then in Tailwind reference them (`bg-[var(--mg-bg)]`) or map to theme colors (below).

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
      bd: 'var(--mg-bd)', accent: '#C8102E', accentSerif: 'var(--mg-accent-serif)',
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
