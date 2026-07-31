"use client";

import { useEffect, type RefObject } from "react";

/**
 * Traps Tab inside `panelRef` while `open`, and restores focus to whatever was
 * focused before on close (WCAG 2.2 AA — see CLAUDE.md "Accessibility").
 *
 * Split out of the old `OverlayScrim` so overlays can own their own markup — the
 * prototype's search overlay and drawer have their own scrims, backdrops and
 * entry animations, and can't share a generic shell — without losing the trap.
 *
 * `skipInitialFocus` leaves focus alone on open, for panels that autofocus a
 * field themselves (the search input).
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  { skipInitialFocus = false }: { skipInitialFocus?: boolean } = {}
) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];

    if (!skipInitialFocus && panel && !panel.contains(document.activeElement)) {
      (focusables()[0] ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, panelRef, skipInitialFocus]);
}
