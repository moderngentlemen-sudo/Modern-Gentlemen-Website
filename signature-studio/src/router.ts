/**
 * Minimal client-side routing (Cloudflare Pages serves index.html for every
 * path). "/" is the marketing site, "/app" the dashboard, "/app/s/<id>" the
 * editor. Digital cards are any path with ?card=.
 */
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
window.addEventListener("popstate", notify);

export function go(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search) return;
  if (opts.replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.scrollTo(0, 0);
  notify();
}

export function usePath(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => location.pathname,
  );
}

export type Route = { page: "landing" } | { page: "dashboard" } | { page: "editor"; id: string };

export function parseRoute(path: string): Route {
  const m = /^\/app\/s\/([\w-]+)\/?$/.exec(path);
  if (m) return { page: "editor", id: m[1] };
  if (path.startsWith("/app")) return { page: "dashboard" };
  return { page: "landing" };
}
