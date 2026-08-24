/**
 * Which image URLs Next's optimiser may be pointed at, and what width to ask
 * it for.
 *
 * **Why this needs to exist at all.** `next/image` does not degrade when it
 * meets a URL it is not configured for — it throws, and on a public route that
 * is a 500 rather than an ugly picture. The public site renders image URLs that
 * come out of the database, and `MediaUrlControl` lets an editor type any URL
 * they like into one, so "every src is a path we control" is a fact about the
 * seed data and not a property of the system. Anything this file calls
 * un-optimisable is handed to `next/image` as `unoptimized`, which renders it
 * untouched instead of failing the page.
 *
 * Pure by construction: no `next/*`, no React, no I/O. Client components import
 * it (`components/ui/MediaImage.tsx` is used inside client trees), so it must
 * also stay clear of Node built-ins — see the standing rule in CLAUDE.md about
 * `UnhandledSchemeError`.
 */

/**
 * Hosts the optimiser is allowed to fetch from.
 *
 * **This must agree with `images.remotePatterns` in `next.config.mjs`**, and
 * `images.test.ts` asserts that it does by reading the config rather than
 * trusting this comment — the two are a pair, and a pair that can drift
 * silently is the shape this repo keeps getting bitten by. Wildcards follow
 * Next's own rule: `*` matches exactly one label, `**` matches one or more.
 */
export const OPTIMIZABLE_IMAGE_HOSTS = ["*.supabase.co"] as const;

/** Next's `remotePatterns` hostname matching: `*` is one label, `**` is many. */
function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern === host) return true;

  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(2); // ".supabase.co"
    return host.endsWith(suffix) && host.length > suffix.length;
  }

  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".supabase.co"
    if (!host.endsWith(suffix)) return false;
    const label = host.slice(0, -suffix.length);
    return label.length > 0 && !label.includes(".");
  }

  return false;
}

/**
 * May `next/image` optimise this src, or must it be passed through untouched?
 *
 * Four things are deliberately refused even though they are same-origin:
 *
 * - **SVG.** The optimiser answers 400 for `image/svg+xml` unless
 *   `dangerouslyAllowSVG` is set, and it is not — an SVG is a script-bearing
 *   document, and the media library accepts uploads. The two site logos are
 *   SVGs, so this branch is exercised on every page.
 * - **`data:` and `blob:`** — already inline; there is nothing to fetch, and
 *   the optimiser rejects both.
 * - **A protocol-relative `//host/x.jpg`** — it is not same-origin however much
 *   it looks it, and its host has not been checked.
 * - **Anything unparseable**, which includes the empty string.
 */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (isSvgPath(src)) return false;

  // Root-relative: served by this app, so no host check applies. `//` is not
  // root-relative — it is protocol-relative and points somewhere else.
  if (src.startsWith("/")) return !src.startsWith("//");

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  return OPTIMIZABLE_IMAGE_HOSTS.some((pattern) => hostMatchesPattern(url.hostname, pattern));
}

/** `.svg` on the path, ignoring any query string or fragment. */
function isSvgPath(src: string): boolean {
  const path = src.split(/[?#]/, 1)[0] ?? "";
  return path.toLowerCase().endsWith(".svg");
}

/**
 * The `sizes` values the public site uses, named after the slot rather than the
 * measurement.
 *
 * **`sizes` is the whole point of the exercise and the easiest thing to get
 * silently wrong.** `next/image` with `fill` and no `sizes` assumes `100vw` and
 * picks a source wide enough for the viewport — so a thumbnail in a four-up
 * grid downloads the 1920px file and the page is no lighter than it was with a
 * plain `<img>`. Nothing errors and nothing looks wrong; the bytes just stay.
 * `tests/perf/budget.spec.ts` is what actually holds this honest.
 *
 * Each value is read off the component's own breakpoints, so it belongs beside
 * them conceptually — it lives here so the budget test and the components
 * cannot disagree about what a slot is worth.
 */
export const IMAGE_SIZES = {
  /** Edge-to-edge band: the hero cover, the full-bleed feature. */
  fullBleed: "100vw",
  /** Half the 1320px column at desktop, full width below the 2-up breakpoint. */
  half: "(min-width: 821px) 660px, 100vw",
  /** A 4-up product/editorial grid: 2 columns below `lg`, 4 above. */
  quarter: "(min-width: 1024px) 330px, 50vw",
  /** A 4-up film/category strip inside the 1320 column. */
  strip: "(min-width: 981px) 320px, (min-width: 681px) 50vw, 100vw",
  /** The PDP's main gallery image — half the column at desktop. */
  gallery: "(min-width: 768px) 660px, 100vw",
  /** A small square: cart lines, search results, PDP thumbnails. */
  thumb: "120px",
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

/**
 * The `1x` candidate out of a `srcSet`, or `null` if there isn't one.
 *
 * **Why this is needed.** `getImageProps` sets `props.src` to the *largest*
 * candidate it generated — the `2x` entry for a fixed-width image. So asking it
 * for a 1920px poster and taking `props.src` gets a **3840px** file: the
 * homepage hero came back at 421 KB when ~200 KB was the intent, and the three
 * film posters at 3840 between them. Nothing warns; the URL simply carries a
 * `w=` twice what was asked for.
 *
 * A poster and a `background-image` cannot use a `srcSet` at all — they take a
 * single URL — so the choice is which candidate to take, and the `1x` is the
 * one whose width is the width that was requested.
 *
 * Kept here, pure and away from `getImageProps`, so it can be tested without a
 * Next runtime.
 *
 * ⚠️ **Parsing is anchored on the descriptor, not on the commas.** A `srcSet` is
 * a comma-separated list of `<url> <descriptor>` pairs, but a URL may itself
 * contain a comma — splitting on `,` chopped `.../a,b.jpg 1x` in half and
 * returned `b.jpg`. Matching `<non-whitespace> <descriptor>` instead is
 * unambiguous, because the descriptor is always a number followed by `x` or `w`
 * and always the last token in its candidate.
 */
export function oneXFromSrcSet(srcSet: string | undefined): string | null {
  if (!srcSet) return null;

  const candidate = /(\S+)\s+([0-9.]+[xw])(?=\s*(?:,|$))/g;
  for (const [, url, descriptor] of srcSet.matchAll(candidate)) {
    if (descriptor === "1x") return url!;
  }
  return null;
}
