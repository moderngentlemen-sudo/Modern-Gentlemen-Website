"use client";
import { useEffect, useRef } from "react";

import { MediaVideo } from "../ui/MediaVideo";
import { optimizedImageUrl } from "../ui/imageUrl";

/** Muted loop, started imperatively (React's `muted` is unreliable) and never for reduced motion. */
export function StageVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !src) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.muted = true;
    element.defaultMuted = true;
    element.play().catch(() => {});
  }, [src]);
  return (
    <MediaVideo
      ref={ref}
      src={src}
      poster={poster ? optimizedImageUrl(poster, 1920) : undefined}
      className={className}
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
