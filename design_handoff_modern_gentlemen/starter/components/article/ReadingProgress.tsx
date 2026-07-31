"use client";

import { useEffect, useRef } from "react";

/** Fixed 3px reading-progress bar (red fill) tracking scroll depth. The global
 *  prefers-reduced-motion rule zeroes the width transition. */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const el = barRef.current;
      if (!el) return;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight || 1;
      const pct = Math.min(
        100,
        Math.max(0, ((h.scrollTop || document.body.scrollTop) / max) * 100)
      );
      el.style.width = pct + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className="fixed inset-x-0 top-0 z-[80] h-[3px]"
      style={{ background: "color-mix(in srgb, var(--mg-bd) 6%, transparent)" }}
    >
      <div
        ref={barRef}
        className="h-full w-0 bg-mg-accent transition-[width] duration-100 ease-linear"
      />
    </div>
  );
}
