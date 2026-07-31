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
        {required && <span className="text-mg-accentSerif"> *</span>}
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
        className={clsx(CONTROL, "resize-y leading-relaxed")}
      />
    </FieldShell>
  );
}

export { FieldShell };
