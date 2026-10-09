/** Small, consistent form controls used across every panel. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pipette, X } from "lucide-react";
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

const RECENT_KEY = "signet.recentColors";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const pushRecent = (c: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...readRecent().filter((x) => x !== c)].slice(0, 8)));
  } catch {
    /* storage blocked: recents are a convenience */
  }
};

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * A colour control: one swatch button that opens a picker with this
 * signature's colours first, then the brand kit, recent picks and more —
 * plus a hex field and, where the browser has one, an eyedropper.
 */
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
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const design = useStudio((s) => s.doc?.design);
  const brand = useStudio((s) => s.prefs.brand);
  useEffect(() => setHex(value), [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  const uniq = (l: (string | undefined)[]) => [...new Set(l.filter((x): x is string => !!x && /^#[0-9a-f]{6}$/i.test(x)).map((x) => x.toLowerCase()))];
  const mine = uniq([...extra, design?.accent, design?.text, design?.muted, design?.surface]);
  const kit = uniq([brand?.accent, brand?.text, brand?.muted, brand?.surface]).filter((x) => !mine.includes(x));
  const recent = open ? uniq(readRecent()).filter((x) => !mine.includes(x) && !kit.includes(x)) : [];
  const more = uniq(swatches).filter((x) => !mine.includes(x) && !kit.includes(x) && !recent.includes(x));
  const pick = (c: string) => {
    onChange(c);
    pushRecent(c.toLowerCase());
  };
  const name = typeof label === "string" ? label : "Colour";
  const Dropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  const row = (title: string, list: string[]) =>
    list.length ? (
      <div className="cp-row">
        <span className="cp-title">{title}</span>
        <div className="swatches">
          {list.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              aria-pressed={c === value.toLowerCase()}
              onClick={() => pick(c)}
            />
          ))}
        </div>
      </div>
    ) : null;
  return (
    <Field label={label}>
      <div className="color-field" ref={ref}>
        <button type="button" className="color-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${name}: ${value}`} data-color-field>
          <span className="color-chip" style={{ background: value }} />
          <span className="color-hex">{value.toUpperCase()}</span>
        </button>
        {open && (
          <div className="color-pop" role="dialog" aria-label={`${name} picker`}>
            {row("This signature", mine)}
            {row("Brand kit", kit)}
            {row("Recent", recent)}
            {row("More", more)}
            <div className="cp-custom">
              <input
                className="input sm"
                value={hex}
                onChange={(e) => {
                  setHex(e.target.value);
                  const v = e.target.value.trim();
                  const norm = /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith("#") ? v : `#${v}`) : null;
                  if (norm) pick(norm.toLowerCase());
                }}
                aria-label={`${name} hex`}
                spellCheck={false}
              />
              <label className="color-pick" title="Custom colour">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                  onChange={(e) => pick(e.target.value)}
                  aria-label={`Custom ${name}`}
                />
              </label>
              {Dropper && (
                <button
                  type="button"
                  className="icon-btn sm"
                  title="Pick a colour from the screen"
                  aria-label="Eyedropper"
                  onClick={() =>
                    void new Dropper()
                      .open()
                      .then((r) => pick(r.sRGBHex.toLowerCase()))
                      .catch(() => undefined)
                  }
                >
                  <Pipette size={15} />
                </button>
              )}
            </div>
          </div>
        )}
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
