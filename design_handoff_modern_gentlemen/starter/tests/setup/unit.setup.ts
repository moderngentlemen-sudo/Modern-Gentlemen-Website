import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * jsdom implements neither of these, and the design system leans on both:
 * `matchMedia` gates every reduced-motion check (CLAUDE.md requires motion to
 * be gated), and IntersectionObserver drives hero video autoplay.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom implements no scrolling, so `window.scrollTo` throws "Not implemented"
// and prints a stack. `lib/useScrollLock` restores the scroll position on
// unlock, which every admin Dialog does on close.
if (typeof window.scrollTo !== "function" || !vi.isMockFunction(window.scrollTo)) {
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
}

// jsdom has no layout engine, so <video>.play() rejects. Sections that autoplay
// hero media call it defensively; stub it so those tests stay quiet.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
}
