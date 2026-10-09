/**
 * Installable, offline app: registers the service worker (production builds
 * only — in development it would cache stale modules) and exposes the
 * browser's install prompt to the UI.
 */
import { create } from "zustand";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** The deferred install prompt, when the browser offers one. */
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

export const usePwa = create<PwaState>(() => ({
  prompt: null,
  installed: typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches,
}));

export function setupPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    usePwa.setState({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => usePwa.setState({ prompt: null, installed: true }));
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => undefined));
  }
}

/** iPhone/iPad Safari has no install prompt: people use Share → Add to Home Screen. */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export async function install(): Promise<boolean> {
  const p = usePwa.getState().prompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  usePwa.setState({ prompt: null });
  return outcome === "accepted";
}
