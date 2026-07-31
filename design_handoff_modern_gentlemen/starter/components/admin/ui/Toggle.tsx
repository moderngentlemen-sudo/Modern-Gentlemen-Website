"use client";

import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING, HELP_TEXT, LABEL } from "./styles";

/**
 * A switch, for `field.boolean` and for the block's own `visibility.hidden` /
 * `locked` flags. Nothing in the site's primitives covers this.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox: the
 * control reads as on/off, not as a member of a set.
 */
export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, help, disabled }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className={clsx(LABEL, "block")}>{label}</span>
        {help && <span className={HELP_TEXT}>{help}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-5 w-9 shrink-0 border transition-colors",
          checked ? "border-mg-accent bg-mg-accent" : "border-mg-bd/30 bg-transparent",
          disabled && "pointer-events-none opacity-40",
          FOCUS_RING
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all",
            checked ? "left-[18px] bg-white" : "left-[2px] bg-mg-fg/40"
          )}
        />
      </button>
    </div>
  );
}

/**
 * A checkbox, for genuinely multi-select values — `visibility.devices` is the
 * one Phase 4 needs, where a block may target any subset of mobile/tablet/desktop.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-mg-fg/80">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={clsx("h-3.5 w-3.5 accent-mg-accent", FOCUS_RING)}
      />
      {label}
    </label>
  );
}
