"use client";

import { useEffect, useId, useState } from "react";
import { CONTROL } from "./styles";
import { FieldShell } from "./Input";

/**
 * A numeric control that survives being typed into.
 *
 * The subtlety worth stating: it holds a *string* internally. Driving a number
 * input straight off a `number` prop makes the intermediate states of typing
 * un-representable — "", "-", "1." are all `NaN`, so a controlled input would
 * fight the editor's keystrokes and clobber the field. The string is the edit
 * buffer; `onChange` fires only when it parses.
 *
 * `QtyStepper` is the site's numeric control and is not a substitute: it has no
 * typed entry and no min/max clamping, while `NumberField` carries `min`, `max`
 * and `integer`.
 */
export interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  name?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  name,
  min,
  max,
  integer,
  help,
  error,
  required,
  disabled,
}: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));

  // Re-sync when the value changes from outside (undo, rollback, a different
  // block selected) — but not while the draft already represents this number,
  // or every keystroke would be overwritten by its own round trip.
  useEffect(() => {
    const parsed = draft.trim() === "" ? undefined : Number(draft);
    if (parsed !== value) setDraft(value === undefined ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draft` is the buffer, not an input
  }, [value]);

  function commit(next: string) {
    setDraft(next);

    if (next.trim() === "") {
      onChange(undefined);
      return;
    }

    const parsed = Number(next);
    if (!Number.isFinite(parsed)) return; // mid-typing: "-", "1.", "1e"
    if (integer && !Number.isInteger(parsed)) return;
    if (min !== undefined && parsed < min) return;
    if (max !== undefined && parsed > max) return;

    onChange(parsed);
  }

  return (
    <FieldShell label={label} help={help} error={error} required={required} htmlFor={id}>
      <input
        id={id}
        name={name}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        value={draft}
        min={min}
        max={max}
        step={integer ? 1 : "any"}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        data-invalid={error ? "" : undefined}
        aria-invalid={!!error}
        className={CONTROL}
      />
    </FieldShell>
  );
}
