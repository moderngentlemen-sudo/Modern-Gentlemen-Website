"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Eyebrow } from "../ui/Eyebrow";

interface Props {
  badge?: string;          // red mono pill, e.g. "COVER STORY — ISSUE 042"
  eyebrow?: string;        // serif italic kicker, e.g. "The Cover Interview"
  headline: string;        // supports "\n" for an explicit line break
  sub?: string;            // dek
  media?: { kind?: "image" | "video"; image?: string; videoUrl?: string };
  cta?: { label: string; href: string };
  credit?: string;         // mono, e.g. "PHOTOGRAPHY · E. MARLOWE"
  meta?: string;           // mono bottom line, e.g. "NO. 042 — A. BELLAMY — 11 MIN"
  mobileHeight?: "auto" | "tall" | "fullscreen";
}

/**
 * Hero — Cover Star. Cover media on the right meets a dark left panel at a 1px
 * divider, with an overlapping lower-left headline block; full-screen, bleeding
 * up behind the transparent fixed header (-mt-[72px]). Video autoplay is set
 * imperatively (React `muted` is unreliable) and gated by reduced-motion.
 */
export function HeroCoverStar({ badge, eyebrow, headline, sub, media, cta, credit, meta, mobileHeight = "fullscreen" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = media?.kind === "video" && !!media.videoUrl;

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

  const minH = mobileHeight === "fullscreen" ? "min-h-[100svh]" : mobileHeight === "tall" ? "min-h-[560px] md:min-h-[100svh]" : "min-h-[440px] md:min-h-[100svh]";

  return (
    <section data-darkband className={`relative -mt-[72px] ${minH} bg-[#0d0d0d] text-[#f4f4f4] overflow-hidden`}>
      {/* Cover media — full-bleed on mobile, right 54% on desktop */}
      <div className="absolute inset-0 md:left-[46%]">
        {isVideo ? (
          <video
            ref={videoRef}
            src={media!.videoUrl}
            poster={media!.image}
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : media?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-white/5" />
        )}
      </div>

      {/* Legibility scrims: solid-left fading right, plus a bottom rise */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] via-[#0d0d0d]/85 to-transparent md:via-[#0d0d0d]/70" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0b]/90 to-transparent" />
      {/* 1px divider where the dark panel meets the cover */}
      <div aria-hidden className="hidden md:block absolute inset-y-0 left-[46%] w-px bg-white/10" />

      {/* Overlapping lower-left content block */}
      <div className="container-mg absolute inset-x-0 bottom-0 pb-[64px] pt-[120px]">
        <div className="max-w-[640px]">
          {badge && (
            <span className="inline-block bg-mg-accent text-white font-mono uppercase text-[11px] tracking-[0.18em] px-3 py-1.5">
              {badge}
            </span>
          )}
          {eyebrow && <Eyebrow className="block mt-5 text-xl">{eyebrow}</Eyebrow>}
          <h1 className="mt-3 font-grotesk font-semibold text-[clamp(46px,8.2vw,84px)] leading-[0.92] tracking-[-0.055em] text-balance whitespace-pre-line">
            {headline}
          </h1>
          {sub && <p className="mt-6 max-w-[520px] text-lg text-white/75 text-pretty">{sub}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-6">
            {cta && (
              <Link
                href={cta.href}
                className="inline-flex items-center bg-mg-accent text-white px-8 py-3.5 font-mono uppercase text-xs tracking-[0.15em] transition-colors hover:bg-white hover:text-mg-accent"
              >
                {cta.label}
              </Link>
            )}
            {credit && <span className="font-mono uppercase text-[11px] tracking-[0.18em] text-white/50">{credit}</span>}
          </div>
          {meta && <p className="mt-10 font-mono uppercase text-[11px] tracking-[0.18em] text-white/45">{meta}</p>}
        </div>
      </div>

      {/* Vertical scroll rail */}
      <div aria-hidden className="hidden md:flex absolute right-7 bottom-10 items-center">
        <span className="font-mono uppercase text-[10px] tracking-[0.3em] text-white/50 [writing-mode:vertical-rl]">Scroll ↓</span>
      </div>
    </section>
  );
}
