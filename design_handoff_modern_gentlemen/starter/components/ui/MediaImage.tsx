import Image from "next/image";

import { IMAGE_SIZES, isOptimizableImageSrc, type ImageSizeKey } from "@/lib/domain/images";

interface Props {
  /** May be a root-relative path, a Supabase asset, or whatever an editor typed. */
  src: string;
  alt: string;
  /** Which slot this fills — decides the `sizes` attribute. See IMAGE_SIZES. */
  slot: ImageSizeKey;
  /** Applied to the <img>, exactly as it was on the element this replaces. */
  className?: string;
  /**
   * The LCP element for the route. Preloads, sets `fetchpriority="high"` and
   * turns lazy loading off. **At most one per route** — marking several is the
   * same as marking none, because the browser has nothing left to prioritise.
   */
  priority?: boolean;
}

/**
 * The public site's `<img>`, everywhere it covers a box that sizes itself.
 *
 * Every image on the public site had the same shape before this existed — an
 * `<img className="h-full w-full object-cover">` inside a container that had
 * already established the box, each with its own
 * `eslint-disable-next-line @next/next/no-img-element` above it. There were 23
 * of those disables; the rule had been asking for this component since Track A.
 *
 * **What it buys:** a `srcset`, so a 208×255 card stops downloading a 1440×1800
 * JPEG; WebP/AVIF where the browser takes it; and `loading="lazy"` on
 * everything not marked `priority`. The homepage was shipping 3,936 KB of
 * images — the entire `public/images/` directory, at full resolution, to a
 * 375px phone.
 *
 * **`fill`, not width/height.** Every call site is `object-cover` inside a box
 * whose size is set by the layout (an `aspect-[4/5]`, an `h-[300px]`, an inset
 * parent), and the intrinsic dimensions are not known here — the src is a
 * string from the database. `fill` reproduces exactly what
 * `absolute inset-0 h-full w-full` did.
 *
 * ⚠️ **The parent must be a positioning context.** `fill` is
 * `position: absolute`, so a parent that is `static` lets the image escape to
 * the nearest positioned ancestor and cover the wrong box. Several call sites
 * needed `relative` adding for that reason; on a block box with no other
 * positioned children it changes no pixels, which the 16 baselines confirm.
 *
 * ⚠️ **`unoptimized` is a fallback, not a switch.** `next/image` throws on a
 * host it is not configured for, and on a public route that is a 500 — so an
 * editor pasting a third-party URL into a media field could take a page down.
 * `isOptimizableImageSrc` decides; see `lib/domain/images.ts` for what it
 * refuses and why. This is the same reasoning `components/admin/media` records
 * for keeping its previews on a plain `<img>`, applied at the one place that
 * can act on it rather than at each call site.
 */
export function MediaImage({ src, alt, slot, className, priority }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={IMAGE_SIZES[slot]}
      priority={priority}
      unoptimized={!isOptimizableImageSrc(src)}
      className={className}
    />
  );
}
