"use client";

import { useEffect, useRef } from "react";
import { clsx } from "@/components/ui/clsx";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useScrollLock } from "@/lib/useScrollLock";
import { HAIRLINE, LABEL_SM, SURFACE } from "./styles";
import { IconButton } from "./Button";

/**
 * The admin modal — publish confirmation, schedule, preview links, history.
 *
 * The WCAG behaviour is not reimplemented here: `lib/useFocusTrap` and
 * `lib/useScrollLock` were extracted in Track A precisely so overlays could keep
 * their own markup without each re-deriving the trap and the iOS-safe lock. The
 * site's `Drawer` is not reusable — it is chrome with its own entry animation
 * and its own position — but its behaviour hooks are.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider variant for the history and diff views. */
  size?: "md" | "lg";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, panelRef);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 sm:p-10">
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "relative z-10 w-full border",
          HAIRLINE,
          SURFACE,
          size === "lg" ? "max-w-[840px]" : "max-w-[520px]"
        )}
      >
        <header className={clsx("flex items-start gap-4 border-b px-5 py-4", HAIRLINE)}>
          <div className="min-w-0 flex-1">
            <h2 className="font-grotesk text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>
            {description && <p className="mt-1 text-[12px] text-mg-fg/60">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            ✕
          </IconButton>
        </header>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <footer className={clsx("flex justify-end gap-2 border-t px-5 py-3", HAIRLINE)}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** A labelled row inside a dialog or panel — the OrderSummary `Row` idiom. */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 border-b py-2", HAIRLINE)}>
      <span className={LABEL_SM}>{label}</span>
      <span className="min-w-0 text-right text-[13px]">{children}</span>
    </div>
  );
}
