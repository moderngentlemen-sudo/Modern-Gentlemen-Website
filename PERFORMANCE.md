# Performance & responsiveness evaluation

Measured against a production build (`next build` + `next start`, Next 15.5.21) of
`design_handoff_modern_gentlemen/starter`, Chromium 1440×900 desktop and a 390×844 /
4×-CPU-throttled mobile profile. Numbers below are observed, not estimated, unless
labelled as an estimate.

**Status:** P0 (videos), P1 (images) and P2 (scroll handler, blurs) are **done** — see
"Results" below. P1 (client-rendered PDP) and the P3 notes are still outstanding.

---

## Results

| | Homepage | /shop | /article/* |
|---|---|---|---|
| Transferred, before | 4.27 MB | 4.28 MB | 2.77 MB \* |
| Transferred, after | **0.51 MB** | **0.33 MB** | **0.64 MB** |
| Images, before | 4.02 MB | 4.02 MB | 2.52 MB \* |
| Images, after | **0.25 MB** | **0.06 MB** | — |
| Reduction | **−88%** | **−92%** | **−77%** |

\* The article baseline was measured mid-migration, after the `<img>` call sites were
converted but before the `background-image` ones were; its true starting weight was
higher. Homepage and /shop are clean before/after pairs on identical builds.

Plus the two hotlinked videos — 38.8 MB and 1.9 GB — no longer load at all.

**Visual regression check** (required by `CLAUDE.md`): full-page captures of 5 pages ×
2 viewports, before vs after, on identical builds. Every page height is byte-identical,
so nothing shifted. Pixel deltas: category-desktop 0.000%, article-desktop 0.001%,
category-mobile 0.002%, article-mobile 0.064%, shop-desktop 0.120%, shop-mobile 0.127%,
pdp-mobile 0.152%, pdp-desktop 0.221% — all WebP recompression noise.

The one outlier, home-desktop at 1.85%, is a **capture artifact, not a regression**:
Chromium's full-page screenshot does not always paint `next/image` elements that were
lazily decoded outside the original viewport, so two of the six "The Latest" tiles come
out blank in the capture. Scrolling to those tiles and screenshotting the real viewport
renders them correctly, and a DOM probe confirms all images report `complete: true` with
the expected `naturalWidth` and box size.

---

## Baseline (before)

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

## P0 — A 1.9 GB video is wired into the homepage  ✅ DONE

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

## P0 — The hero streams a 38.8 MB trailer on load  ✅ DONE

`HERO_COVER_VIDEO` measures `content-length: 38773165`. `HeroCoverStar` autoplays it
whenever it is 35% visible, which on the homepage is immediately.

**Fix:** self-host a trimmed, muted loop (≤ 10 s, 1920×1080, target < 2.5 MB), keep the
poster as the LCP paint, use `preload="none"`, and defer `.play()` until after the
`load` event so it never competes with the poster and the fonts.

## P1 — Every image is a raw `<img>` at full source resolution  ✅ DONE

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

**Actual result:** homepage images 4.02 MB → **0.25 MB**, /shop 4.02 MB → **0.06 MB**.
`_next/image` output is additionally served `max-age=31536000, immutable`, so repeat
views cost nothing.

**A second class of images, missed in the first pass.** Converting the 16 raster `<img>`
call sites left the article page at 2.52 MB, because six components paint their cover as
a CSS `background-image` instead — `CategoryHero`, `FeaturedLead`, `StoryBand`,
`ArticleGrid`, `article/RelatedGrid`, and the `bg()` helper shared by three structured
article bodies. Those bypass the optimizer completely and pull the raw 4K source. They
now go through `lib/bgImage.ts`, which wraps Next's `getImageProps()` — the sanctioned
escape hatch for background images. The markup is untouched, so only the bytes change;
the category page's pixel diff is 0.000% desktop / 0.002% mobile.

The three SVG logos stay as plain `<img>`: `next/image` will not optimize SVG without
`dangerouslyAllowSVG`, and they are 3–10 KB already.

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

## P1 — The product page ships as client-rendered HTML  ⬜ OUTSTANDING

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

## P2 — The scroll handler updates React state on every scroll event  ✅ DONE

`lib/useHideOnScroll.ts:44-66` calls `setScrolled` / `setHidden` directly inside the
scroll listener. The listener is correctly `{ passive: true }`, but it is not
rAF-coalesced and it sets state even when the boolean has not flipped.

Measured on the 4×-throttled mobile profile across a 1.6 s scroll of the homepage:
long tasks of **163 ms, 65 ms, 192 ms**. Anything over 50 ms is a dropped-frame window.

**Fix:** coalesce the handler into a `requestAnimationFrame` tick and guard both
`setState` calls behind an actual value change. Small, self-contained, no visual risk.

## P2 — Stacked and animated backdrop filters  ✅ DONE

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

## Remaining work

1. **Supply owned footage for the hero and the film row.** The video code paths are all
   intact and gated on a `videoUrl`; `lib/media.ts` documents the budget. Until then both
   sections render their still, and the film tiles are inert (a click would only ever
   open the "Preview only" placeholder).
2. **Un-client the PDP and `/shop`.** Unchanged from the analysis above — best folded
   into the Supabase wiring step, since it touches the same files.
3. **Re-encode the seven source JPEGs.** Not required for the byte savings — the
   optimizer already handles that — but it would cut ~4 MB from the repo and reduce the
   optimizer's cold-cache CPU. Measured cold, generating 49 variants from the 4K sources
   took 4 s total (worst single variant 0.34 s), so this is a nice-to-have, not a risk.
4. **`style-mono.jpg` is only 1280×720** but is painted full-bleed by `FeatureSplit` at
   1425px and wider. The optimizer correctly refuses to upscale, so that band is soft on
   large and retina screens. This predates the migration; it needs a bigger source, not
   a code change.

### What was measured and rejected

- **JS.** 102 kB shared, 116 kB first load. Healthy; no action.
- **The scroll handler as a source of jank.** It was rAF-coalesced anyway (correct, and
  it removes redundant renders), but the long tasks did not move: ~180–220 ms before and
  after, across three runs each. They are image decode, not the handler. The image work
  is what addresses them.
