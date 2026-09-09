"use client";
import { useEffect, useState, type RefObject } from "react";
import { HEADER_ENTRY_FRAMES, lightHeaderBackground } from "@/lib/domain/headerAppearance";
import { sampleGradient, sampleColor } from "./headerBackdrop";
import type { ThemeHeader } from "@/lib/domain/theme";

/** Sample visible surfaces below the chrome. Never fetch or export media pixels. */
function backgroundAt(x: number, y: number, chrome: HTMLElement): number[] {
  const hits = document
    .elementsFromPoint(x, y)
    .filter((el) => !chrome.contains(el) && !el.closest("[data-header-scrim]"));
  const layers = [
    ...new Set([
      ...hits,
      ...document.querySelectorAll("img,video,[data-media-overlay],[data-header-backdrop]"),
    ]),
  ]
    .filter((el) => {
      if (chrome.contains(el) || el.closest("[data-header-scrim]")) return false;
      const r = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        x >= r.left &&
        x < r.right &&
        y >= r.top &&
        y < r.bottom &&
        css.visibility !== "hidden" &&
        css.display !== "none"
      );
    })
    .sort((a, b) =>
      a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
  const base = sampleColor(getComputedStyle(document.body).backgroundColor);
  let result = base.slice(0, 3);
  for (const el of layers) {
    const css = getComputedStyle(el);
    const color = sampleColor(css.backgroundColor);
    if (color?.length) {
      const alpha = (color[3] ?? 1) * Number(css.opacity);
      result = result.map((v, i) => v * (1 - alpha) + color[i] * alpha);
    }
    const gradient = sampleGradient(css.backgroundImage, el.getBoundingClientRect(), x, y);
    if (gradient) {
      const alpha = (gradient[3] / 255) * Number(css.opacity);
      result = result.map((v, i) => v * (1 - alpha) + gradient[i] * alpha);
    }
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      try {
        const w = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
        const h = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
        if (!w || !h) continue;
        const rect = el.getBoundingClientRect();
        const scale =
          css.objectFit === "contain"
            ? Math.min(rect.width / w, rect.height / h)
            : Math.max(rect.width / w, rect.height / h);
        const pos = css.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
        const sx =
          (x - rect.left - (rect.width - w * scale) * (Number.isFinite(pos[0]) ? pos[0] : 0.5)) /
          scale;
        const sy =
          (y - rect.top - (rect.height - h * scale) * (Number.isFinite(pos[1]) ? pos[1] : 0.5)) /
          scale;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx?.drawImage(el, sx, sy, 1, 1, 0, 0, 1, 1);
        const pixel = ctx?.getImageData(0, 0, 1, 1).data;
        if (pixel)
          result = result.map(
            (v, i) => v * (1 - Number(css.opacity)) + pixel[i] * Number(css.opacity)
          );
      } catch {
        /* Cross-origin media keeps the surrounding surface/theme fallback. */
      }
    }
  }
  return result;
}
export function useHeaderAppearance(
  ref: RefObject<HTMLDivElement | null>,
  settings: ThemeHeader,
  frosted: boolean
) {
  const [darkInk, setDarkInk] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !settings.autoContrast) {
      setDarkInk(false);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      if (document.visibilityState === "hidden") return;
      const y = Math.max(2, Math.min(settings.height / 2, window.innerHeight - 1));
      const samples = [0.15, 0.5, 0.85].map((p) => backgroundAt(window.innerWidth * p, y, el));
      let rgb = [0, 1, 2].map((i) => samples.reduce((sum, s) => sum + s[i], 0) / samples.length);
      if (settings.background === "filled") {
        const fill = settings.fillColor.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16));
        rgb = rgb.map(
          (v, i) => v * (1 - settings.fillOpacity / 100) + (fill[i] * settings.fillOpacity) / 100
        );
      } else if (frosted) rgb = rgb.map((v) => v * 0.45 + 13 * 0.55);
      setDarkInk(lightHeaderBackground(rgb));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mgtheme"],
    });
    // Video frames and animated surfaces can change without a scroll event.
    const timer = window.setInterval(schedule, 600);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("load", schedule, true);
    };
  }, [
    ref,
    settings.autoContrast,
    settings.background,
    settings.fillColor,
    settings.fillOpacity,
    settings.height,
    frosted,
  ]);
  useEffect(() => {
    const el = ref.current,
      frames = HEADER_ENTRY_FRAMES[settings.entryAnimation];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!el || !frames?.length || motion.matches || !el.animate) return;
    const animation = el.animate(frames, {
      duration: settings.entryDuration,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
    const cancel = () => {
      if (motion.matches) animation.cancel();
    };
    motion.addEventListener("change", cancel);
    return () => {
      animation.cancel();
      motion.removeEventListener("change", cancel);
    };
  }, [ref, settings.entryAnimation, settings.entryDuration]);
  return darkInk;
}
