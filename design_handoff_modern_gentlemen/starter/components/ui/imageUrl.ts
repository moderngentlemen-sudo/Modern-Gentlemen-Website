import { getImageProps } from "next/image";

import { isOptimizableImageSrc, oneXFromSrcSet } from "@/lib/domain/images";

/**
 * An optimised URL for the two places `next/image` cannot reach: a
 * `<video poster>` and a CSS `background-image`.
 *
 * **Why these need a path of their own.** `MediaImage` covers every `<img>` on
 * the public site, but a poster takes a URL rather than an element, and the
 * design uses `bg-cover bg-center` background layers for most of its decorative
 * imagery — the category hero, the article grid cards, the story band, the
 * mega-menu feature, the article body galleries. Those are `aria-hidden`
 * scrim-and-cover layers rather than content images; turning them into elements
 * would restructure pixel-verified components for no user-visible gain. So the
 * URL is optimised in place and the CSS is left exactly as it was.
 *
 * This was not an optional extra: with only the `<img>` sites converted, `/style`
 * was still shipping all 3,936 KB and the article routes over 2,200 KB, because
 * every image on them is a background layer.
 *
 * `getImageProps` is Next's supported escape hatch for exactly this — it runs
 * the same pipeline `<Image>` does and returns the attributes instead of an
 * element, explicitly for `<video poster>`, background images and `<picture>`.
 *
 * A src the optimiser would refuse comes back untouched, for the reason
 * `MediaImage` passes `unoptimized` — see `lib/domain/images.ts`.
 *
 * ⚠️ **`width` is a fixed request, not a `sizes` negotiation.** Neither a poster
 * nor a `background-image` carries a `srcset`, so one width serves every
 * viewport and each call site picks the narrowest that still covers its slot on
 * a desktop screen. This is a real, if small, deviation from serving the
 * original: a background layer is no longer pixel-identical at every zoom level.
 * It is invisible to the sixteen baselines at their 1440px capture width, which
 * is a weaker guarantee than those baselines usually give — recorded rather
 * than relied upon.
 */
export function optimizedImageUrl(src: string, width: number): string {
  if (!isOptimizableImageSrc(src)) return src;

  const { props } = getImageProps({
    src,
    alt: "",
    width,
    // Only the width reaches the optimiser; height is required by the type and
    // sets the aspect Next reasons about. 16:9 is a neutral choice — the real
    // crop is done by `object-cover` / `bg-cover` in every case.
    height: Math.round((width * 9) / 16),
    quality: 70,
  });

  // `props.src` is the LARGEST candidate — the 2x entry — so taking it would
  // request a file twice the width asked for. See `oneXFromSrcSet`.
  return oneXFromSrcSet(props.srcSet) ?? props.src;
}

/** The same URL, wrapped for a `background-image` declaration. */
export function backgroundImageUrl(src: string, width: number): string {
  return `url(${optimizedImageUrl(src, width)})`;
}
