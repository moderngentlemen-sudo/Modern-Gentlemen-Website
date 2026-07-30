# Performance & responsiveness evaluation

Measured against a production build (`next build` + `next start`, Next 15.5.21) of
`design_handoff_modern_gentlemen/starter`, Chromium 1440×900 desktop and a 390×844 /
4×-CPU-throttled mobile profile. Numbers below are observed, not estimated, unless
labelled as an estimate.

Nothing in this document has been implemented. It is a ranked list of what to change,
with the evidence for each and the risk it carries against the pixel-exactness contract
in `CLAUDE.md`.

---

## Baseline

| | Homepage | /shop |
|---|---|---|
| Requests | 35 | 43 |
| Transferred | **4.27 MB** | **4.28 MB** |
| — of which images | **4.02 MB** | **4.02 MB** |
| DOM nodes | 253 | 281 |
| FCP (local, no network latency) | 364 ms | 124 ms |

JS bundle, from the build report:

```
+ First Load JS shared by all      102 kB
/                                  116 kB
/shop                              113 kB
/admin/builder                     136 kB   ← largest route
```

**The JavaScript is healthy. The media is not.** 94% of every page's bytes are images,
and that is before the two hotlinked videos are counted.

HTML is gzipped correctly (`Content-Encoding: gzip`), fonts are self-hosted by
`next/font` and total 172 kB across all weights. Neither is worth touching.

---

## P0 — A 1.9 GB video is wired into the homepage

`starter/lib/media.ts` → `FILM_PREVIEW_VIDEO` points at a Wikimedia 4K/60fps clip.
Measured with a `HEAD` request:

```
content-type: video/webm
content-length: 1900657185      ← 1.9 GB
```

All three tiles in the MG Film row use it (`app/page.tsx:83-85`), and
`components/sections/FilmStills.tsx` will:

- autoplay it in tile 1 via `IntersectionObserver` at 35% visibility (`:59-70`),
- start playback on hover of *any* tile (`:72-78`),
- open a lightbox with `autoPlay` on click (`:45`).

So a visitor who scrolls to the film row begins streaming an unbounded 4K/60 file from
a third-party host and decoding it into a 240px-tall box. On a phone this is the single
most damaging thing on the site — and `PROGRESS.md` already flags it as a rights problem
too.

**Fix:** replace with an owned, self-hosted clip — 1280×720, 6–10 s, H.264 MP4 with a
WebM sibling, target < 3 MB. Until that footage exists, render the poster `<img>` on the
tiles and drop the `<video>` element entirely; set `preload="none"` and only attach the
source on hover/click intent rather than at mount.

## P0 — The hero streams a 38.8 MB trailer on load

`HERO_COVER_VIDEO` measures `content-length: 38773165`. `HeroCoverStar` autoplays it
whenever it is 35% visible, which on the homepage is immediately.

**Fix:** self-host a trimmed, muted loop (≤ 10 s, 1920×1080, target < 2.5 MB), keep the
poster as the LCP paint, use `preload="none"`, and defer `.play()` until after the
`load` event so it never competes with the poster and the fonts.

## P1 — Every image is a raw `<img>` at full source resolution

19 call sites use bare `<img>` (`grep -rn "<img" components app`). No `srcset`, no
`sizes`, no `loading="lazy"`, no modern format. Every one of them ships the original
JPEG regardless of how small it renders. Measured on the live pages:

| asset | natural | rendered at | shipped |
|---|---|---|---|
| `hero-cover.jpg` | 3840×2160 | 313×391 (a /shop product thumb) | 1,677 KB |
| `watch-gear.jpg` | 1440×1800 | 208×255 (The Latest tile) | 501 KB |
| `film-watchmaker.jpg` | 1440×1800 | 208×255 | 690 KB |
| `film-workshop.jpg` | 1440×1800 | 208×255 | 492 KB |

/shop is the worst case: 16 product cards render at 313×391 and between them pull the
full 4.02 MB set, all eagerly (`loading` is `auto` on every image on the page).

Everything under `/public` is also served `Cache-Control: public, max-age=0`, so repeat
visits revalidate the full set on every navigation.

I measured the achievable win by pushing the same files through Next's built-in
optimizer, which is already available and needs no new dependency:

| asset | raw JPEG | 640w WebP | 1920w WebP |
|---|---|---|---|
| `hero-cover.jpg` | 1,677 KB | **20.9 KB** | 164 KB |
| `watch-gear.jpg` | 501 KB | **18.9 KB** | 98.8 KB |
| `film-watchmaker.jpg` | 690 KB | **28.9 KB** | 194 KB |

**Estimated result:** homepage images 4.02 MB → ~350–500 KB, /shop 4.02 MB → ~400 KB.
That is an ~88% cut in page weight. `_next/image` output is additionally served
`max-age=31536000, immutable`, so repeat views cost nothing.

For scale: at a typical 4G effective throughput of ~1.6 Mbps, the 1.68 MB hero poster
alone is roughly 8 seconds before the LCP element can paint. Local testing hides this
completely — the 364 ms FCP above is measured over loopback.

**Fix:** migrate the 19 `<img>` call sites to `next/image` with `fill` +
`className="object-cover"` and an accurate `sizes`, plus `priority` on the hero poster
and lazy on everything below the fold. Re-encode the seven source JPEGs down from 4K
while doing it.

**Risk:** `next/image` with `fill` renders the same box as the current absolutely
positioned `<img>` (it adds a `position:absolute` wrapper), so this should be visually
neutral — but `CLAUDE.md` requires a screenshot diff per section afterwards, and that
diff pass is the real cost of this item, not the code change.

## P1 — The product page ships as client-rendered HTML

`app/product/[slug]/page.tsx` is `"use client"` for its whole body, only because of
`useCart`. Consequence, from the build report:

```
ƒ /product/[slug]        2.28 kB    114 kB    ← Dynamic, server-rendered on demand
```

The product story, specs table, and related grid — all static content — are rendered in
the browser rather than shipped as HTML, and the route can't be prerendered because
`generateStaticParams` is illegal in a client file.

**Fix:** make the page a server component with `generateStaticParams()` over the 16
catalog slugs, and push the client island down to the buy box (quantity stepper,
add-to-bag, gallery thumbnail state). Same shape applies to `/shop`, whose
`useSearchParams` filter is the only reason that page is client.

**Impact:** the PDP becomes SSG — instant HTML, edge-cacheable — and less JS runs before
first meaningful paint. Worth doing before the Supabase swap, since that step will touch
these files anyway.

## P2 — The scroll handler updates React state on every scroll event

`lib/useHideOnScroll.ts:44-66` calls `setScrolled` / `setHidden` directly inside the
scroll listener. The listener is correctly `{ passive: true }`, but it is not
rAF-coalesced and it sets state even when the boolean has not flipped.

Measured on the 4×-throttled mobile profile across a 1.6 s scroll of the homepage:
long tasks of **163 ms, 65 ms, 192 ms**. Anything over 50 ms is a dropped-frame window.

**Fix:** coalesce the handler into a `requestAnimationFrame` tick and guard both
`setState` calls behind an actual value change. Small, self-contained, no visual risk.

## P2 — Stacked and animated backdrop filters

Two separate issues, same root cause:

- `components/chrome/Header.tsx:103` puts `backdrop-filter` in a **transition**
  (`transition: background .45s, backdrop-filter .45s, …`). Animating a filter re-runs a
  full-viewport-width blur every frame for 450 ms, on every frost-in and frost-out.
- The search overlay stacks **two** blur layers — `backdrop-blur-sm` on the scrim
  (`OverlayScrim.tsx:77`) and `backdrop-blur-lg` on the panel
  (`SearchOverlay.tsx:41`) — over an autoplaying video hero.

Measured on 4× CPU throttle: **274 ms** to open the search overlay, **833 ms** to type 7
characters into it.

Notably the prototype already solved this and the port dropped it: `MG Header.dc.html`
carries a `mobileSearchBlur` prop and a `body[data-searchblur="false"]` rule that
disables the blur on small screens, commented *"lighter, cheaper blur so the search
overlay opens without lag on mobile."*

**Fix:** cross-fade the opacity of a pre-blurred layer instead of transitioning the
filter itself; collapse the overlay to a single blur layer; restore the prototype's
mobile opt-out below ~820px.

## P3 — Known costs to leave alone

- **`text-rendering: geometricPrecision` on `body`** (`globals.css:72`) is load-bearing
  for the design — `PROGRESS.md` documents that hinted advances re-wrap every dek off
  the prototype's line breaks. It does raise text raster cost site-wide on low-end
  Android. Keep it, but treat it as a spent budget: don't add further full-page repaint
  triggers on top of it.
- **`scroll-behavior: smooth`** globally is a deliberate design choice and is already
  gated by the `prefers-reduced-motion` block.
- **Legacy Sanity dependencies** (`sanity`, `@sanity/*`, `styled-components`) never reach
  the client bundle, so they cost nothing at runtime — but they inflate `npm ci` and
  build time on Railway. Their removal is already scheduled in PROGRESS.md Track B.

---

## Layout responsiveness

The Phase 7 responsive pass (documented in `PROGRESS.md`) covered breakpoints, touch
targets, and overflow across all pages, and I found nothing to add to it. The two
residuals recorded there — a 26px phantom `scrollWidth` on the 768px PDP and the
red-on-red MOST POPULAR notch at narrow widths — are both still accurate and both still
cosmetic.

The interaction-latency items above (P2) are where "responsiveness" is actually being
lost on mobile, not in layout.

---

## Suggested order

1. **Replace the two hotlinked videos** — largest win, smallest diff, and it clears a
   licensing blocker at the same time.
2. **Migrate to `next/image` + re-encode the source JPEGs** — ~88% page-weight cut. The
   screenshot diff pass is the bulk of the work.
3. **Un-client the PDP and /shop** — best folded into the Supabase wiring step.
4. **rAF the scroll handler; de-stack the blurs** — cheap, self-contained, fixes the
   measured mobile jank.
