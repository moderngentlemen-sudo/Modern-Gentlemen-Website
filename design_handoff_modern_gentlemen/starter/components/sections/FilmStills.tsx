"use client";

import { useState } from "react";

interface Item {
  title: string;
  still?: string;
  videoUrl?: string;
  duration?: string;
}

/** MG Film — 3-up video stills. Click opens a simple lightbox.
 *  (Prototype also auto-plays the first still on scroll-in — add an
 *  IntersectionObserver + reduced-motion guard when you wire real video.) */
export function FilmStills({ heading = "MG Film", items }: { heading?: string; items: Item[] }) {
  const [active, setActive] = useState<Item | null>(null);
  return (
    <section className="container-mg py-16 md:py-24">
      <h2 className="font-grotesk text-2xl md:text-3xl mb-8">{heading}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items?.map((it, i) => (
          <button key={i} onClick={() => setActive(it)} className="group text-left">
            <div className="relative aspect-video overflow-hidden bg-mg-surface">
              {it.still && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.still} alt={it.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              )}
              <span className="absolute inset-0 grid place-items-center">
                <span className="h-14 w-14 rounded-full bg-mg-accent/90 grid place-items-center text-white text-xl">▶</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="font-grotesk text-lg">{it.title}</h3>
              {it.duration && <span className="font-mono text-xs text-mg-fg/50">{it.duration}</span>}
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 bg-black/90 grid place-items-center p-6" onClick={() => setActive(null)}>
          <div className="w-full max-w-4xl aspect-video bg-black" onClick={(e) => e.stopPropagation()}>
            {active.videoUrl ? (
              <video src={active.videoUrl} controls autoPlay className="h-full w-full" />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/60 font-mono text-sm">No video URL</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
