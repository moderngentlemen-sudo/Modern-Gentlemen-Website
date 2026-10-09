/**
 * Visual font picker: every font previewed in its own face, grouped, with
 * recently used fonts first and an honest note on what recipients will see.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { FONTS, fontDef, fontStack, type FontDef } from "../core/fonts";
import { Field } from "./kit";

const RECENT_KEY = "signet.recentFonts";
const recentFonts = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const rememberFont = (id: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentFonts().filter((x) => x !== id)].slice(0, 5)));
  } catch {
    /* a convenience only */
  }
};

const GROUPS: { title: string; test: (f: FontDef) => boolean }[] = [
  { title: "Shows everywhere", test: (f) => f.safe },
  { title: "Serif", test: (f) => !f.safe && f.category === "serif" },
  { title: "Sans serif", test: (f) => !f.safe && f.category === "sans" },
  { title: "Display", test: (f) => !f.safe && f.category === "display" },
  { title: "Mono", test: (f) => !f.safe && f.category === "mono" },
];

export function FontPicker({
  label,
  value,
  onChange,
  defaultLabel = "Signature default",
  sample,
  testId,
}: {
  label: ReactNode;
  /** Font id, or "" for the signature's default. */
  value: string;
  onChange: (id: string) => void;
  defaultLabel?: string;
  /** Preview text; defaults to the font's name. */
  sample?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  const current = value ? fontDef(value) : null;
  const choose = (id: string) => {
    onChange(id);
    if (id) rememberFont(id);
    setOpen(false);
  };
  const recent = open ? recentFonts().filter((id) => FONTS.some((f) => f.id === id)) : [];
  const option = (f: FontDef) => (
    <button key={f.id} type="button" role="option" aria-selected={f.id === value} className="fp-opt" onClick={() => choose(f.id)} data-font={f.id}>
      <span className="fp-sample" style={{ fontFamily: fontStack(f.id) }}>
        {sample || f.label}
      </span>
      <span className="fp-meta">
        {f.label}
        {!f.safe && <span className="fp-seen"> · most inboxes show {f.seenAs}</span>}
      </span>
      {f.id === value && <Check size={14} className="fp-check" />}
    </button>
  );
  return (
    <Field label={label}>
      <div className="font-picker" ref={ref}>
        <button type="button" className="fp-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" data-testid={testId}>
          <span style={{ fontFamily: current ? fontStack(current.id) : undefined }}>{current ? current.label : defaultLabel}</span>
          <ChevronDown size={15} />
        </button>
        {open && (
          <div className="fp-pop" role="listbox" aria-label="Fonts">
            <button type="button" role="option" aria-selected={!value} className="fp-opt" onClick={() => choose("")}>
              <span className="fp-sample">{defaultLabel}</span>
              {!value && <Check size={14} className="fp-check" />}
            </button>
            {recent.length > 0 && (
              <>
                <div className="fp-group">Recent</div>
                {recent.map((id) => option(fontDef(id)))}
              </>
            )}
            {GROUPS.map((g) => {
              const list = FONTS.filter(g.test);
              return list.length ? (
                <div key={g.title}>
                  <div className="fp-group">{g.title}</div>
                  {list.map(option)}
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </Field>
  );
}
