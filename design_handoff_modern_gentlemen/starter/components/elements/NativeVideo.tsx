"use client";

import { useEffect, useRef } from "react";

import { mediaAppearanceStyle, type MediaAppearance } from "@/lib/blocks/mediaAppearance";
import { textTypographyStyle, type TextTypography } from "@/lib/blocks/textTypography";
import { FontStylesheet } from "../ui/FontStylesheet";
import { clsx } from "@/components/ui/clsx";

const ASPECT = {
  auto: "",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  wide: "aspect-video",
  cinema: "aspect-[21/9]",
} as const;

export function NativeVideo({
  appearance,
  captionTypography,
  src,
  poster,
  caption,
  aspect = "wide",
  fit = "cover",
  controls = true,
  autoplay = false,
  loop = false,
  muted = true,
}: {
  appearance?: MediaAppearance;
  captionTypography?: TextTypography;
  src: string;
  poster?: string;
  caption?: string;
  aspect?: keyof typeof ASPECT;
  fit?: "cover" | "contain";
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!autoplay || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.play().catch(() => {});
  }, [autoplay]);

  return (
    <figure>
      <FontStylesheet font={captionTypography?.fontFamily} />
      <video
        style={mediaAppearanceStyle(appearance)}
        ref={ref}
        src={src}
        poster={poster}
        controls={controls}
        loop={loop}
        muted={muted || autoplay}
        playsInline
        preload="metadata"
        className={clsx(
          "block w-full bg-black",
          ASPECT[aspect],
          aspect !== "auto" && (fit === "cover" ? "object-cover" : "object-contain")
        )}
      />
      {caption && (
        <figcaption
          style={textTypographyStyle(captionTypography ?? {})}
          className="mt-2 text-[12px] text-mg-fg/60"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
