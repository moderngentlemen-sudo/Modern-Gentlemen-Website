"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

interface Props {
  badge?: string;          // red mono pill, e.g. "COVER STORY — ISSUE 042"
  eyebrow?: string;        // serif italic kicker, e.g. "The Cover Interview"
  headline: string;        // supports "\n" for an explicit line break
  sub?: string;            // dek
  media?: { kind?: "image" | "video"; image?: string; videoUrl?: string };
  cta?: { label: string; href: string };
  credit?: string;         // mono, e.g. "PHOTOGRAPHY · E. MARLOWE"
  meta?: string;           // mono bottom-left rail, e.g. "NO. 042 — A. BELLAMY — 11 MIN"
  mobileHeight?: "auto" | "tall" | "fullscreen";
}

/**
 * Hero — Cover Star, the prototype's `heroVariant: 'Cover bottom'` at
 * `heroSize: 'Full screen'`: a 100vh full-bleed cover (video, or image when no
 * video URL is set) under a single bottom-rising scrim, with the headline block
 * inset 44px from the left and 72px up from the bottom, and the issue meta and
 * vertical SCROLL rail pinned to the bottom corners.
 *
 * The hero bleeds up behind the transparent fixed header (no top offset needed —
 * the bar is `position: fixed`). Video autoplay is set imperatively (React's
 * `muted` prop is unreliable) and gated on reduced-motion.
 */
export function HeroCoverStar({ badge, eyebrow, headline, sub, media, cta, credit, meta, mobileHeight = "fullscreen" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = !!media?.videoUrl && media?.kind !== "image";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.muted = true;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? el.play().catch(() => {}) : el.pause())),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [media?.videoUrl]);

  // Desktop is always 100vh; only the phone height varies (heroMobileHeight).
  const frameH =
    mobileHeight === "fullscreen"
      ? "h-[100svh] min-[681px]:h-screen"
      : mobileHeight === "tall"
        ? "h-[560px] min-[681px]:h-screen"
        : "h-[470px] min-[681px]:h-screen";

  return (
    // -mt-[72px] cancels the layout's header offset so the cover bleeds up
    // behind the transparent fixed bar, exactly as the prototype's hero does.
    <section id="top" data-darkband className="-mt-[72px] text-[#f4f4f4]">
      <div className={`relative overflow-hidden border-b border-white/10 bg-[#0d0d0d] ${frameH}`}>
        {/* Cover media — full-bleed behind everything. */}
        <div className="absolute inset-0">
          {isVideo ? (
            <video
              ref={videoRef}
              src={media!.videoUrl}
              poster={media!.image}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover bg-[#0d0d0d]"
            />
          ) : media?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
          {/* Single bottom-rising legibility scrim ('Cover bottom'); ≤680 it
              flattens to an even wash so centered text stays readable. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-[rgba(13,13,13,0.5)] min-[681px]:bg-[linear-gradient(0deg,rgba(10,10,11,0.9),transparent_55%)]"
          />
        </div>

        {/* Headline block — lower-left, over the cover. The prototype leaves
            line-height at `normal` here; Tailwind's fixed leading would add
            ~8px of stack height and push the whole block up off its baseline. */}
        {/* ≤680 (heroMobileTextAlign: 'Center') the block spans the full width
            with a 24px inset and centers; ≥681 it insets 44px from the left. */}
        <div className="absolute inset-x-0 bottom-[66px] z-[2] px-6 text-center leading-[normal] text-white min-[681px]:inset-x-auto min-[681px]:left-11 min-[681px]:bottom-[72px] min-[681px]:max-w-[640px] min-[681px]:px-0 min-[681px]:text-left">
          {badge && (
            <span className="inline-block bg-[rgba(200,16,46,0.9)] px-[11px] py-1 font-mono text-[8px] leading-[normal] tracking-[0.24em] text-white">
              {badge}
            </span>
          )}
          {eyebrow && (
            <div className="mt-3.5 font-serif italic text-[16px] leading-[normal] text-[#ff4d5e]">{eyebrow}</div>
          )}
          <h1
            className="mt-2 font-grotesk font-semibold text-[44px] min-[681px]:text-[84px] leading-[0.92] tracking-[-0.055em] whitespace-pre-line"
            style={{ textShadow: "0 4px 40px rgba(13,13,13,0.6)" }}
          >
            {headline}
          </h1>
          {sub && (
            <p
              className="mt-5 mx-auto max-w-[400px] font-grotesk font-light text-base leading-[1.6] text-[rgba(244,244,244,0.78)] min-[681px]:mx-0"
              style={{ textShadow: "0 2px 20px rgba(13,13,13,0.8)" }}
            >
              {sub}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-[18px] leading-[normal] min-[681px]:justify-start">
            {cta && (
              <Link
                href={cta.href}
                className="inline-block bg-mg-accent px-7 py-[13px] font-mono text-[9px] leading-[normal] tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-mg-accent"
              >
                {cta.label}
              </Link>
            )}
            {credit && (
              <span className="font-mono text-[9px] leading-[normal] tracking-[0.16em] text-white/60">{credit}</span>
            )}
          </div>
        </div>

        {/* Bottom rails — issue meta (left) and the vertical scroll cue (right). */}
        {meta && (
          <div className="absolute left-5 bottom-[22px] pointer-events-none font-mono text-[8px] leading-[normal] tracking-[0.14em] text-white/55 min-[681px]:left-11 min-[681px]:bottom-[30px] min-[681px]:text-[10px] min-[681px]:tracking-[0.22em]">
            {meta}
          </div>
        )}
        <div
          aria-hidden
          className="hidden min-[681px]:block absolute right-8 bottom-[30px] pointer-events-none font-mono text-[10px] leading-[normal] tracking-[0.28em] text-white/55 [writing-mode:vertical-rl]"
        >
          SCROLL ↓
        </div>
      </div>
    </section>
  );
}
