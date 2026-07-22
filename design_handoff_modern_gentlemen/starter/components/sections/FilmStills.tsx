"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../ui/Eyebrow";

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
export function FilmStills({ heading = "MG Film", eyebrow, allHref, allLabel = "All episodes →", items }: Props) {
  const [active, setActive] = useState<Item | null>(null);
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          {eyebrow && <Eyebrow className="block">{eyebrow}</Eyebrow>}
          <h2 className="mt-2 font-grotesk font-semibold text-3xl md:text-[42px] leading-none tracking-[-0.02em]">{heading}</h2>
        </div>
        {allHref && <Link href={allHref} className="shrink-0 font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accent whitespace-nowrap">{allLabel}</Link>}
      </div>

      <div className="grid grid-cols-1 min-[681px]:grid-cols-3 gap-[22px]">
        {items?.map((it, i) => <FilmTile key={i} item={it} autoplay={i === 0} onOpen={() => setActive(it)} />)}
      </div>

      {active && (
        <div className="fixed inset-0 z-[210] bg-black/90 grid place-items-center p-6" onClick={() => setActive(null)}>
          <div className="w-full max-w-4xl aspect-video bg-black" onClick={(e) => e.stopPropagation()}>
            {active.videoUrl ? (
              <video src={active.videoUrl} controls autoPlay className="h-full w-full" />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/60 font-mono text-sm">Preview only</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilmTile({ item, autoplay, onOpen }: { item: Item; autoplay?: boolean; onOpen: () => void }) {
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
    <button onClick={onOpen} onMouseEnter={hoverPlay} onMouseLeave={hoverPause} className="group text-left">
      <div className="relative aspect-video overflow-hidden bg-mg-surface">
        {item.videoUrl ? (
          <video ref={vidRef} src={item.videoUrl} poster={item.still} loop muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : item.still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.still} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : null}
        <span aria-hidden className="absolute top-3 left-3 grid place-items-center h-11 w-11 rounded-full bg-black/45 backdrop-blur text-white text-sm">▶</span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 bg-gradient-to-t from-black/75 to-transparent">
          <h3 className="font-grotesk text-white text-sm leading-snug">{item.title}</h3>
          {item.duration && <span className="shrink-0 font-mono text-[11px] text-white/80">{item.duration}</span>}
        </div>
      </div>
    </button>
  );
}
