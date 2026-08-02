"use client";

import { clsx } from "@/components/ui/clsx";
import type { AssetView } from "@/lib/services/media";

/**
 * One asset's visual, at whatever size the caller gives it.
 *
 * A plain `<img>`, deliberately not `next/image` — the same reason
 * `MediaUrlControl` has carried since Phase 4: `next.config.mjs` allows only
 * `*.supabase.co` in `remotePatterns`, and 0002's `external_url` column exists
 * precisely so third-party and legacy `/public` media can be catalogued
 * alongside what we host. `next/image` would reject those outright.
 *
 * Non-visual kinds get a mono label rather than a broken frame: an editor
 * scanning a grid needs to know a row is a PDF, not see the browser's failed
 * image glyph.
 */
export function AssetThumb({ asset, className }: { asset: AssetView; className?: string }) {
  const box = clsx(
    "relative flex items-center justify-center overflow-hidden bg-mg-fg/5",
    className
  );

  if (asset.kind === "image" || asset.kind === "gif") {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
        <img
          src={asset.url}
          alt={asset.altText ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%` }}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      </div>
    );
  }

  if (asset.kind === "video") {
    return (
      <div className={box}>
        <video
          src={asset.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[18px] text-white/80 drop-shadow"
        >
          ▶
        </span>
      </div>
    );
  }

  return (
    <div className={box}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/45">
        {asset.kind}
      </span>
    </div>
  );
}
