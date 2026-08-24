"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../ui/Eyebrow";
import { MediaImage } from "../ui/MediaImage";
import { optimizedImageUrl } from "../ui/imageUrl";

interface Item {
  title: string;
  still?: string;
  videoUrl?: string;
  duration?: string;
}
interface Props {
  heading?: string;
  eyebrow?: string;
  allHref?: string;
  allLabel?: string;
  items: Item[];
}

/** MG Film — 3-up video stills. The first tile auto-plays (muted) on scroll-in;
 *  any tile plays on hover; click opens a lightbox. Reduced-motion disables
 *  autoplay. */
export function FilmStills({
  heading = "MG Film",
  eyebrow,
  allHref,
  allLabel = "All episodes →",
  items,
}: Props) {
  const [active, setActive] = useState<Item | null>(null);
  return (
    <section className="container-mg pt-20 pb-[72px]">
      <div className="flex items-baseline justify-between gap-4 mb-7">
        <div>
          {eyebrow && (
            <Eyebrow className="block !text-[20px] !leading-[normal] !text-mg-muted">
              {eyebrow}
            </Eyebrow>
          )}
          <h2 className="mt-1.5 font-grotesk font-semibold text-3xl leading-[1.05] min-[681px]:text-[42px] min-[681px]:leading-none tracking-[-0.035em]">
            {heading}
          </h2>
        </div>
        {allHref && (
          <Link
            href={allHref}
            className="shrink-0 font-mono uppercase text-[11px] tracking-[0.18em] text-mg-accent whitespace-nowrap"
          >
            {allLabel}
          </Link>
        )}
      </div>

      {/* 3-up ≥1025, 2-up ≤1024, stacked ≤680 — the prototype's card breakpoints. */}
      <div className="grid grid-cols-1 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-[22px]">
        {items?.map((it, i) => (
          <FilmTile key={i} item={it} autoplay={i === 0} onOpen={() => setActive(it)} />
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[210] bg-black/90 grid place-items-center p-6"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-4xl aspect-video bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {active.videoUrl ? (
              <video src={active.videoUrl} controls autoPlay className="h-full w-full" />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/60 font-mono text-sm">
                Preview only
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilmTile({
  item,
  autoplay,
  onOpen,
}: {
  item: Item;
  autoplay?: boolean;
  onOpen: () => void;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = vidRef.current;
    if (!el || !item.videoUrl || !autoplay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.muted = true;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => (e.isIntersecting ? el.play().catch(() => {}) : el.pause())),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item.videoUrl, autoplay]);

  const hoverPlay = () => {
    const el = vidRef.current;
    if (el && item.videoUrl) {
      el.muted = true;
      el.play().catch(() => {});
    }
  };
  const hoverPause = () => {
    const el = vidRef.current;
    if (el && item.videoUrl && !autoplay) el.pause();
  };

  return (
    <button
      onClick={onOpen}
      onMouseEnter={hoverPlay}
      onMouseLeave={hoverPause}
      className="group text-left"
    >
      <div className="relative h-[240px] overflow-hidden bg-[#0d0d0d]">
        {item.videoUrl ? (
          <video
            ref={vidRef}
            src={item.videoUrl}
            poster={item.still ? optimizedImageUrl(item.still, 640) : undefined}
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : item.still ? (
          <MediaImage
            src={item.still}
            alt={item.title}
            slot="strip"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <span
          aria-hidden
          className="absolute top-[14px] left-4 flex items-center justify-center h-11 w-11 rounded-full border border-white/25 text-white text-[12px] leading-[normal] pl-0.5"
          style={{
            background: "rgba(16,16,18,0.5)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          ▶
        </span>
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-[18px] py-[14px] border-t border-white/[0.14] text-white pointer-events-none"
          style={{
            background: "rgba(16,16,18,0.45)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <h3 className="font-grotesk font-medium text-[15px] leading-[normal] tracking-[-0.01em]">
            {item.title}
          </h3>
          {item.duration && (
            <span className="shrink-0 font-mono text-[9.5px] leading-[normal] text-white/60">
              {item.duration}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
