"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  /** Scroll depth (px) past which the chrome frosts in. */
  frostAt?: number;
  /** Scroll depth (px) below which the bar never hides — heroes keep the nav.
   *  The prototype re-shows unconditionally under this depth, so do the same. */
  hideAt?: number;
  /** Deltas smaller than this are rubber-band / trackpad jitter, not intent. */
  threshold?: number;
  /** While true the bar is held visible and scroll is ignored (see below). */
  pinned?: boolean;
};

/**
 * Scroll state for the fixed header: `scrolled` (frost in) plus `hidden`
 * (slide away on scroll-down, reveal on scroll-up). EXECUTION_PLAN §10 allows
 * the slide-away but never a resize, so the caller only translates the bar.
 *
 * While `pinned` the bar is held visible and scroll events are ignored: the
 * overlays lock the body with the fixed-body technique (`useScrollLock`), which
 * moves the document scroll position and fires scroll events that are not user
 * gestures. Pin transitions re-baseline instead of reading the jump as a
 * direction — the lock/restore events land after this effect, never before.
 */
export function useHideOnScroll({ frostAt = 40, hideAt = 90, threshold = 4, pinned = false }: Options = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const resync = useRef(true);
  const pinnedRef = useRef(pinned);

  useEffect(() => {
    pinnedRef.current = pinned;
    resync.current = true;
    if (pinned) setHidden(false);
  }, [pinned]);

  useEffect(() => {
    const onScroll = () => {
      if (pinnedRef.current) return;
      const y = window.scrollY;
      setScrolled(y > frostAt);
      if (resync.current) {
        resync.current = false;
        lastY.current = y;
        return;
      }
      // Prototype order: below `hideAt` the bar is always shown, and only past
      // it does a >threshold delta decide the direction (a sub-threshold move
      // leaves the previous state alone rather than re-baselining `lastY`).
      if (y < hideAt) {
        lastY.current = y;
        setHidden(false);
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      lastY.current = y;
      setHidden(delta > 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [frostAt, hideAt, threshold]);

  /** Force the bar back (keyboard focus reaching hidden chrome, route change). */
  const reveal = useCallback(() => setHidden(false), []);

  return { scrolled, hidden, reveal };
}
