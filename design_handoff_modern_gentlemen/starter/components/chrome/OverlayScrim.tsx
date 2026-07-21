"use client";

import { useEffect } from "react";

/** Shared overlay shell: scrim + Esc-to-close + focus return. Scroll lock is
 *  applied by the parent via useScrollLock so it can coordinate one lock across
 *  whichever overlay is open. */
export function OverlayScrim({ open, onClose, children, align = "center" }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "left" | "right";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <div
      className={`fixed inset-0 z-[100] flex ${justify} bg-black/60 backdrop-blur-sm`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="h-full w-full flex">{children}</div>
    </div>
  );
}
