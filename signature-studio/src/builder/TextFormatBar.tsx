/**
 * The formatting toolbar for any block with text: font, weight, size, B I U S,
 * case, colour role and spacing — one place instead of scattered switches.
 * Everything maps to inline CSS Gmail keeps.
 */
import { Bold, Italic, Minus, Plus, Strikethrough, Underline } from "lucide-react";
import type { Block, TextCase } from "../core/types";
import { useStudio } from "../store/editor";
import { ColorField, Field, Segmented, Slider } from "../ui/kit";
import { FontPicker } from "../ui/FontPicker";
import { updateBlock } from "./actions";
import { readTypo, setTypo, WEIGHTS, type RoleChoice, type TypoChange } from "./typography";

const CASES: { value: TextCase; label: string; title: string }[] = [
  { value: "none", label: "Aa", title: "As typed" },
  { value: "upper", label: "AA", title: "Capitals" },
  { value: "lower", label: "aa", title: "Lower case" },
  { value: "title", label: "Ab", title: "Title Case" },
  { value: "smallcaps", label: "Sᴄ", title: "Small capitals" },
];

export function TextFormatBar({ b }: { b: Block }) {
  const design = useStudio((s) => s.doc!.design);
  const t = readTypo(b, design);
  const set = (change: TypoChange, key?: string) => updateBlock(b.id, setTypo(change, design), key ? `typo.${key}` : undefined);
  const toggle = (on: boolean, label: string, icon: React.ReactNode, change: TypoChange, testId: string) => (
    <button type="button" className="tf-btn" aria-pressed={on} title={label} aria-label={label} onClick={() => set(change)} data-testid={testId}>
      {icon}
    </button>
  );
  return (
    <div className="text-format" data-testid="text-format">
      <FontPicker label="Font" value={t.font} onChange={(v) => set({ font: v })} testId="font-picker" />
      <div className="tf-row">
        <label className="tf-weight">
          <span className="sr-only">Weight</span>
          <select className="select sm" value={t.weight} onChange={(e) => set({ weight: Number(e.target.value) })} aria-label="Weight" data-testid="tf-weight">
            {WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <div className="tf-size" role="group" aria-label="Text size">
          <button type="button" className="tf-btn" aria-label="Smaller text" onClick={() => set({ size: t.size - 1 }, "size")}>
            <Minus size={14} />
          </button>
          <input
            className="tf-size-num"
            value={t.size}
            inputMode="numeric"
            aria-label="Text size in pixels"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n) && n >= 8) set({ size: n }, "size");
            }}
            data-testid="tf-size"
          />
          <button type="button" className="tf-btn" aria-label="Larger text" onClick={() => set({ size: t.size + 1 }, "size")}>
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="tf-row">
        <div className="tf-group" role="group" aria-label="Style">
          {toggle(t.bold, "Bold", <Bold size={15} />, { bold: !t.bold }, "tf-bold")}
          {toggle(t.italic, "Italic", <Italic size={15} />, { italic: !t.italic }, "tf-italic")}
          {toggle(t.underline, "Underline", <Underline size={15} />, { underline: !t.underline }, "tf-underline")}
          {toggle(t.strike, "Strikethrough", <Strikethrough size={15} />, { strike: !t.strike }, "tf-strike")}
        </div>
      </div>
      <div className="tf-row">
        <div className="tf-group tf-cases" role="group" aria-label="Case">
          {CASES.map((c) => (
            <button
              key={c.value}
              type="button"
              className="tf-btn tf-case"
              aria-pressed={t.textCase === c.value}
              title={c.title}
              aria-label={c.title}
              onClick={() => set({ textCase: c.value })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Colour">
        <Segmented<RoleChoice>
          label="Text colour role"
          value={t.role}
          onChange={(v) => set({ role: v, color: v === "custom" ? (t.color ?? design.text) : undefined })}
          options={[
            { value: "auto", label: "Auto", title: "As the design sets it" },
            { value: "text", label: "Text" },
            { value: "muted", label: "Muted", title: "Secondary text colour" },
            { value: "accent", label: "Accent" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </Field>
      {t.role === "custom" && <ColorField label="Custom colour" value={t.color ?? design.text} onChange={(c) => set({ role: "custom", color: c }, "color")} />}
      <details className="tf-spacing">
        <summary>Spacing</summary>
        <Slider label="Line height" unit="×" min={1} max={2.2} step={0.05} value={t.lineHeight} onChange={(v) => set({ lineHeight: v }, "lh")} />
        <Slider label="Letter spacing" unit="em" min={-0.05} max={0.4} step={0.01} value={t.tracking} onChange={(v) => set({ tracking: v }, "tr")} />
      </details>
    </div>
  );
}
