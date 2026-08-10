"use client";

import { useId } from "react";
import { clsx } from "@/components/ui/clsx";
import { CONTROL, ERROR_TEXT, HELP_TEXT, LABEL } from "./styles";

/**
 * The admin's text controls.
 *
 * `components/store/Field` cannot serve: it renders no `name` attribute (which
 * is why `SignInForm` mirrors hidden inputs into its server action), carries no
 * `help` slot though every manifest field may declare one, and has no `id` /
 * `htmlFor` pairing. Its `py-3` density is tuned for checkout, a pixel-verified
 * surface, so it is left untouched.
 */
interface FieldShellProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldShell({ label, help, error, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className={clsx(LABEL, "block")}>
        {label}
        {/*
          Hidden from the accessibility tree on purpose. Left visible, the
          asterisk becomes part of the control's accessible name — a screen
          reader announces "Quote star", and CI found the field named `Quote *`.
          Requiredness belongs on the control as `aria-required`, not in its
          name.
        */}
        {required && (
          <span aria-hidden="true" className="text-mg-accentSerif">
            {" *"}
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {help && !error && <span className={HELP_TEXT}>{help}</span>}
      {error && <span className={ERROR_TEXT}>{error}</span>}
    </div>
  );
}

export interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  type?: "text" | "url" | "email" | "password";
  placeholder?: string;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
}

export function TextInput({
  label,
  value,
  onChange,
  name,
  type = "text",
  placeholder,
  help,
  error,
  required,
  disabled,
  onBlur,
}: TextInputProps) {
  const id = useId();
  return (
    <FieldShell label={label} help={help} error={error} required={required} htmlFor={id}>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-invalid={error ? "" : undefined}
        aria-invalid={!!error}
        aria-required={required || undefined}
        className={CONTROL}
      />
    </FieldShell>
  );
}

export interface TextAreaProps extends Omit<TextInputProps, "type"> {
  rows?: number;
}

export function TextArea({
  label,
  value,
  onChange,
  name,
  rows = 4,
  placeholder,
  help,
  error,
  required,
  disabled,
  onBlur,
}: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell label={label} help={help} error={error} required={required} htmlFor={id}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-invalid={error ? "" : undefined}
        aria-invalid={!!error}
        aria-required={required || undefined}
        className={clsx(CONTROL, "resize-y leading-relaxed")}
      />
    </FieldShell>
  );
}

export interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
  disabled?: boolean;
  /** Shown as the placeholder and restored by the swatch's clear affordance. */
  fallback?: string;
}

/**
 * A colour, as a swatch and as text — both, always, and the text field is not
 * the optional half.
 *
 * `<input type="color">` can only express an opaque `#rrggbb`. Four of the
 * nine design tokens are not that: `--mg-muted` and `--mg-faint` are
 * `rgba(244, 244, 244, 0.5)` and `rgba(…, 0.35)` in dark, and
 * `--mg-band-border` is `transparent` in light. A swatch-only control would
 * quietly flatten each of those to a solid colour the first time anyone touched
 * it, and the change would look deliberate. So the text field is the real
 * control and the swatch is an affordance on top of it.
 *
 * The swatch therefore shows `#000000` for a value it cannot represent, which is
 * a lie it cannot avoid — hence `aria-hidden` and `tabIndex={-1}`: it is a
 * pointer convenience, and the text input is what assistive technology and the
 * keyboard get. That is also why the accessible label belongs to the text input
 * and the swatch has none.
 */
export function ColorInput({
  label,
  value,
  onChange,
  help,
  error,
  disabled,
  fallback,
}: ColorInputProps) {
  const id = useId();
  const swatchable = /^#[0-9a-fA-F]{6}$/.test(value.trim());

  return (
    <FieldShell label={label} help={help} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
          value={swatchable ? value.trim().toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "h-9 w-9 shrink-0 cursor-pointer border border-mg-bd/25 bg-transparent p-0.5",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !swatchable && "opacity-40"
          )}
        />
        <input
          id={id}
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value)}
          data-invalid={error ? "" : undefined}
          aria-invalid={!!error}
          className={clsx(CONTROL, "font-mono text-[13px]")}
        />
      </div>
    </FieldShell>
  );
}

export { FieldShell };
