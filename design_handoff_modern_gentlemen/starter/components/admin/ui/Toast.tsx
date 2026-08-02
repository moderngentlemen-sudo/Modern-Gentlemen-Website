"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clsx } from "@/components/ui/clsx";
import { SURFACE } from "./styles";

/**
 * Transient feedback — "Published v4", "Restored version 7 into the draft",
 * "You do not have permission to publish this page".
 *
 * `role="status"` with `aria-live="polite"` rather than `alert`: these follow an
 * action the editor just took, so they should not interrupt what a screen reader
 * is already saying.
 */
export type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<ToastTone, string> = {
  info: "border-mg-bd/25",
  success: "border-mg-accent/50",
  error: "border-mg-accentSerif/60",
};

const DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), DISMISS_MS);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[320px] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              "pointer-events-auto border px-4 py-3 text-[13px] shadow-lg",
              SURFACE,
              TONES[toast.tone]
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns a no-op outside a provider rather than throwing. A toast is feedback,
 * not function: a component rendered in a test or a stray context should not
 * crash the admin because nobody is listening.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: () => {} };
}
