"use client";
import { useEffect, useRef } from "react";

/**
 * Scrolls a standalone stage past its top runway once, on touch screens, so
 * the background sits behind Safari's status bar.
 *
 * ⚠️ This leans on undocumented Safari behaviour (iOS 26+): at scroll 0 Safari
 * paints the status bar area a solid colour sampled from the page, and only
 * composites real page pixels behind it once the page has scrolled. The
 * runway is the stage's own background, so scrolling back up reveals more of
 * the video rather than a band. Never runs in the editor (no
 * [data-site-main]), with a #fragment, or once the visitor has scrolled.
 */
export function StageRunway() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>("[data-stage-layout]");
    if (!stage?.closest("[data-site-main]") || window.location.hash) return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    const runway = parseFloat(getComputedStyle(stage).paddingTop) || 0;
    if (runway > 0 && window.scrollY < 1) window.scrollTo({ top: runway, behavior: "instant" });
  }, []);
  return <span ref={ref} hidden />;
}
