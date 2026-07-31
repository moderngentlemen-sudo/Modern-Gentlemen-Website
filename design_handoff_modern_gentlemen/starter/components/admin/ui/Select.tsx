"use client";

import { useId } from "react";
import type { SelectOption } from "@/lib/blocks/fields";
import { CONTROL } from "./styles";
import { FieldShell } from "./Input";

/**
 * A select over the manifests' own option shape.
 *
 * `components/store/SelectField` takes `options: string[]`, so it is not merely
 * inconvenient here — it cannot express a manifest's options at all. A field's
 * `SelectOption` is `{ value, label }` and the two differ meaningfully:
 * `ctaBand.variant` offers `{ value: "split", label: "Split — heading left,
 * email right" }`. Rendering the value would show an editor "split".
 */
export interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  name?: string;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Shown as a leading blank option when the field is optional and unset. */
  placeholder?: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  name,
  help,
  error,
  required,
  disabled,
  placeholder,
}: SelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} help={help} error={error} required={required} htmlFor={id}>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        data-invalid={error ? "" : undefined}
        aria-invalid={!!error}
        className={CONTROL}
      >
        {placeholder !== undefined && (
          <option value="" className="bg-mg-bg text-mg-fg">
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-mg-bg text-mg-fg">
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
