/** Small, consistent form controls used across every panel. */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useStudio } from "../store/editor";

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  multiline,
  testId,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  type?: string;
  multiline?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      {multiline ? (
        <textarea id={id} className="textarea" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      ) : (
        <input id={id} className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      )}
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  testId,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <label htmlFor={id} style={{ cursor: "pointer" }}>
        <div className="t">{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} testId={testId} />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  id,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  label?: string;
  testId?: string;
}) {
  return (
    <span className="switch">
      <input id={id} type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span />
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  inline,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label?: string;
  inline?: boolean;
}) {
  return (
    <div className={`seg${inline ? " inline" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = "",
  hint,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="slider">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <input
          className="num"
          aria-label={typeof label === "string" ? `${label} value` : undefined}
          value={`${Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}${unit}`}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(clamp(n));
          }}
        />
      </div>
    </Field>
  );
}

export const SWATCHES = ["#5b4cf0", "#0a66c2", "#0f766e", "#16a34a", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#b08d57", "#1f2937", "#111111", "#64748b"];

export function ColorField({
  label,
  value,
  onChange,
  swatches = SWATCHES,
  extra = [],
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  swatches?: string[];
  extra?: string[];
}) {
  const list = [...new Set([...extra, ...swatches].map((s) => s.toLowerCase()))];
  return (
    <Field label={label} hint={value.toUpperCase()}>
      <div className="swatches">
        {list.map((s) => (
          <button
            key={s}
            type="button"
            className="swatch"
            style={{ background: s }}
            aria-label={s}
            aria-pressed={s === value.toLowerCase()}
            onClick={() => onChange(s)}
          />
        ))}
        <label className="color-pick" title="Custom colour">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Custom ${typeof label === "string" ? label : "colour"}`}
          />
        </label>
      </div>
    </Field>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      data-testid={testId}
    >
      {open && (
        <>
          <div className="modal-head">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.message}</span>
          {t.action && <button onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}
