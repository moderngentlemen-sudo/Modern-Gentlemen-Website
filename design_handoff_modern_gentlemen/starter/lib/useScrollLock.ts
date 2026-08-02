"use client";

import { useEffect } from "react";

/**
 * iOS-safe scroll lock (fixed-body technique, ported from the prototype).
 * On lock: save scrollY, pin body position:fixed with negative top.
 * On unlock: restore + scrollTo(savedY), temporarily disabling smooth-scroll
 * so the restore doesn't animate a visible bounce.
 * Shared by the drawer, search overlay, and bag drawer (see 04_CHROME.md).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const y = window.scrollY;
    const body = document.body.style;
    const prev = {
      position: body.position,
      top: body.top,
      left: body.left,
      right: body.right,
      width: body.width,
      overflow: body.overflow,
    };
    body.position = "fixed";
    body.top = `-${y}px`;
    body.left = "0";
    body.right = "0";
    body.width = "100%";
    body.overflow = "hidden";
    return () => {
      Object.assign(document.body.style, prev);
      const html = document.documentElement.style;
      const prevBehavior = html.scrollBehavior;
      html.scrollBehavior = "auto";
      window.scrollTo(0, y);
      html.scrollBehavior = prevBehavior;
    };
  }, [active]);
}
