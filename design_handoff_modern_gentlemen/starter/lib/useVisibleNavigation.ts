"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/db/client";
import {
  isMenuItemVisible,
  type NavLink,
  type NavigationDevice,
  type NavigationViewer,
} from "@/lib/domain/navigation";

function walk(links: NavLink[], predicate: (link: NavLink) => boolean): boolean {
  return links.some((link) => predicate(link) || walk(link.children, predicate));
}

export function filterVisibleNavigation(links: NavLink[], viewer: NavigationViewer): NavLink[] {
  return links.flatMap((link) =>
    isMenuItemVisible(link.visibility, viewer)
      ? [{ ...link, children: filterVisibleNavigation(link.children, viewer) }]
      : []
  );
}

function currentDevice(): NavigationDevice {
  if (window.matchMedia("(max-width: 680px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1024px)").matches) return "tablet";
  return "desktop";
}

/**
 * Applies menu conditions in the browser so public pages remain statically
 * rendered. Unconditional links require no auth request and preserve the
 * existing SSR output. Auth/member/scheduled links fail closed until their
 * viewer state is known.
 */
export function useVisibleNavigation(links: NavLink[]): NavLink[] {
  const needsAudience = walk(
    links,
    (link) =>
      !!link.visibility &&
      ((link.visibility.auth !== undefined && link.visibility.auth !== "any") ||
        (link.visibility.member !== undefined && link.visibility.member !== null))
  );
  const needsDevice = walk(links, (link) => !!link.visibility?.devices);
  const needsClock = walk(
    links,
    (link) => !!(link.visibility?.startsAt || link.visibility?.endsAt)
  );
  const [viewer, setViewer] = useState<NavigationViewer>({
    auth: "unknown",
    member: null,
    device: null,
    now: null,
  });

  useEffect(() => {
    if (!needsDevice) return;
    const update = () => setViewer((value) => ({ ...value, device: currentDevice() }));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [needsDevice]);

  useEffect(() => {
    if (!needsClock) return;
    const update = () => setViewer((value) => ({ ...value, now: Date.now() }));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [needsClock]);

  useEffect(() => {
    if (!needsAudience) return;
    const db = createClient();
    let cancelled = false;

    const resolve = async () => {
      const { data } = await db.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setViewer((value) => ({ ...value, auth: "out", member: false }));
        return;
      }
      const profile = await db
        .from("profiles")
        .select("is_member")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!cancelled) {
        setViewer((value) => ({
          ...value,
          auth: "in",
          member: profile.data?.is_member ?? false,
        }));
      }
    };

    void resolve();
    const subscription = db.auth.onAuthStateChange(() => void resolve());
    return () => {
      cancelled = true;
      subscription.data.subscription.unsubscribe();
    };
  }, [needsAudience]);

  return useMemo(() => filterVisibleNavigation(links, viewer), [links, viewer]);
}
