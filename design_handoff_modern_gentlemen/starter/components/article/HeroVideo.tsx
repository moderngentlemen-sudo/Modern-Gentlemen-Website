"use client";

import { useEffect, useRef } from "react";
import { ArticleKicker, Byline } from "./primitives";
import { MediaImage } from "../ui/MediaImage";
import { optimizedImageUrl } from "../ui/imageUrl";

interface Props {
  kicker: string;
  title: string;
  byline: string;
  videoUrl: string;
  poster?: string;
}

/** Article "Video" hero — full-bleed muted autoplay loop + scrim, centered
 *  caption. Imperative muted play (React `muted` is unreliable), reduced-motion
 *  gated. Falls back to the poster image when no self-contained video asset is
 *  supplied (as the homepage hero does). Bleeds behind the fixed header. */
export function HeroVideo({ kicker, title, byline, videoUrl, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!videoUrl) return;
    const el = videoRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.muted = true;
    el.defaultMuted = true;
    el.play().catch(() => {});
  }, [videoUrl]);
  return (
    <section data-darkband className="relative -mt-[72px] bg-[#0d0d0d] text-[#f4f4f4]">
      <div data-hero-media className="relative h-[80vh] min-h-[540px] overflow-hidden bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster ? optimizedImageUrl(poster, 1920) : undefined}
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : poster ? (
          <MediaImage src={poster} alt="" slot="fullBleed" priority className="object-cover" />
        ) : null}
        <div data-scrim className="pointer-events-none absolute inset-0" />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-6 pb-[56px] text-center">
        <div className="mx-auto max-w-[900px]">
          <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
          <h1
            data-title-xl
            className="font-grotesk font-semibold text-[68px] leading-[0.98] tracking-[-0.045em] text-balance"
          >
            {title}
          </h1>
          <Byline className="mt-[22px] text-mg-fg/[0.62]">{byline}</Byline>
        </div>
      </div>
    </section>
  );
}
