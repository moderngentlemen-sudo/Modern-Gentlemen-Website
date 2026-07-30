import { getImageProps } from "next/image";

/**
 * Optimized URL for a CSS `background-image`.
 *
 * A handful of decorative covers are painted as `background-image` rather than
 * an `<img>` — they sit under gradients and text, and turning them into
 * `next/image` elements would mean re-stacking each one. Those bypassed the
 * image optimizer entirely and shipped the raw 4K source: the article page was
 * still pulling 2.52 MB of JPEG after every `<img>` had been migrated.
 *
 * `getImageProps` is Next's sanctioned escape hatch for exactly this case. It
 * runs the same pipeline `<Image>` does and hands back the optimized URL, so
 * the markup is untouched and only the bytes change (WebP, resized, and served
 * `immutable` instead of `max-age=0`).
 *
 * Pass the widest CSS width the element is ever painted at; Next rounds up to
 * its next device-size bucket. There is no srcset here — a background-image is
 * one URL — so pick for the largest case and let smaller viewports overdraw,
 * which is still an order of magnitude below the original.
 *
 * Server components only (all current callers are). `getImageProps` is not
 * usable during client render.
 */
export function bgImageUrl(src: string, width: number, quality = 75): string {
  const { props } = getImageProps({
    src,
    alt: "",
    width,
    // Only the width drives the generated URL; the height keeps the helper
    // type-correct and is never emitted.
    height: Math.round(width * 0.625),
    quality,
  });
  return props.src;
}

/** `style={bgCover(src, w)}` — the optimized URL as a ready-made style object. */
export function bgCover(src: string, width: number, quality = 75) {
  return { backgroundImage: `url(${bgImageUrl(src, width, quality)})` };
}
