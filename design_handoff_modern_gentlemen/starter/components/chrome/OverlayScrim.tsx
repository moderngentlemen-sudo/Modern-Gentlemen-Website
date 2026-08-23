"use client";

import { useEffect, useRef } from "react";

/** Shared overlay shell: scrim + Esc-to-close + focus trap + focus return.
 *  Scroll lock is applied by the parent via useScrollLock so it can coordinate
 *  one lock across whichever overlay is open. (04_CHROME.md, WCAG 2.2 AA.) */
export function OverlayScrim({
  open,
  onClose,
  children,
  align = "center",
  label,
  id,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "left" | "right";
  label?: string;
  /** DOM id, so the button that opens this can name it via `aria-controls`. */
  id?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  // Keep onClose in a ref so the effect only re-runs when `open` flips
  // (avoids stealing/restoring focus when the parent passes a new closure).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    // Remember what had focus so we can restore it when the overlay closes.
    returnRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Move focus into the overlay — unless something inside already has it
    // (e.g. the search input's autoFocus).
    if (panel && !panel.contains(document.activeElement)) {
      (focusables()[0] ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
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
      returnRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <div
      className={`fixed inset-0 z-[100] flex ${justify} bg-black/60 backdrop-blur-sm`}
      onClick={onClose}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full flex outline-none"
      >
        {children}
      </div>
    </div>
  );
}
