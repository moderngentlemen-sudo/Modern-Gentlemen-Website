/**
 * The formatting toolbar for any block with text: font, weight, size, B I U S,
 * case, colour role and spacing — one place instead of scattered switches.
 * Everything maps to inline CSS Gmail keeps.
 */
import { useRef, useState } from "react";
import { Bold, Italic, Minus, Plus, Strikethrough, Underline } from "lucide-react";
import type { Block, TextCase } from "../core/types";
import { findBlock } from "../core/blocks";
import { customFontId, isCustomFont } from "../core/fonts";
import { applyStyle, effectiveStyle, findStyle, overridesStyle, styleFromBlock } from "../core/textStyles";
import { uid } from "../lib/id";
import { UploadError } from "../store/assets";
import { edit, toast, tree, useStudio } from "../store/editor";
import { addFontFile, FONT_ACCEPT } from "../store/fonts";
import { ColorField, Field, Segmented, Slider, Toggle } from "../ui/kit";
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

/** Linked text styles: pick one, save the block's look as a new one, push changes to it, or detach. */
function TextStyleRow({ b }: { b: Block }) {
  const design = useStudio((s) => s.doc!.design);
  const [naming, setNaming] = useState<string | null>(null);
  const styles = design.textStyles ?? [];
  const linked = findStyle(design, b.style?.textStyle);
  const changed = overridesStyle(b.style, design);
  const save = () => {
    const name = naming?.trim();
    setNaming(null);
    if (!name) return;
    const id = uid("ts");
    edit((d) => {
      const h = tree(d) ? findBlock(tree(d), b.id) : null;
      if (!h) return;
      d.design.textStyles = [...(d.design.textStyles ?? []), styleFromBlock(id, name, effectiveStyle(h.block.style, d.design))];
      h.block.style = applyStyle(h.block.style, id);
    });
    toast(`Saved “${name}”. Apply it to other text from this menu.`, "success");
  };
  return (
    <div className="tf-styles">
      {naming !== null ? (
        <input
          className="input sm"
          autoFocus
          aria-label="Style name"
          placeholder="Style name, e.g. Heading"
          value={naming}
          onChange={(e) => setNaming(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") save();
            if (e.key === "Escape") setNaming(null);
          }}
          onBlur={save}
          data-testid="style-name"
        />
      ) : (
        <select
          className="select sm"
          aria-label="Text style"
          value={linked?.id ?? ""}
          onChange={(e) => updateBlock(b.id, (x) => void (x.style = applyStyle(x.style, e.target.value || undefined)))}
          data-testid="text-style"
        >
          <option value="">No text style</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {!linked && naming === null && (
        <button type="button" className="btn sm" onClick={() => setNaming(`Style ${styles.length + 1}`)} data-testid="save-style">
          Save as style
        </button>
      )}
      {linked && changed && (
        <>
          <button
            type="button"
            className="btn sm"
            title={`Change “${linked.name}” everywhere it's used`}
            onClick={() =>
              edit((d) => {
                const h = tree(d) ? findBlock(tree(d), b.id) : null;
                const list = d.design.textStyles ?? [];
                const i = list.findIndex((s) => s.id === linked.id);
                if (!h || i < 0) return;
                list[i] = styleFromBlock(linked.id, linked.name, effectiveStyle(h.block.style, d.design));
                h.block.style = applyStyle(h.block.style, linked.id);
              })
            }
            data-testid="update-style"
          >
            Update style
          </button>
          <button type="button" className="btn sm ghost" onClick={() => updateBlock(b.id, (x) => void (x.style = applyStyle(x.style, linked.id)))}>
            Reset
          </button>
        </>
      )}
    </div>
  );
}

/** Choose an uploaded brand font, or upload one. */
function useFontUpload(onFont: (id: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const el = (
    <input
      ref={input}
      type="file"
      accept={FONT_ACCEPT}
      hidden
      data-testid="font-upload"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
          const f = await addFontFile(file);
          edit((d) => void (d.customFonts = [...(d.customFonts ?? []).filter((x) => x.family !== f.family), f]));
          onFont(customFontId(f.family));
          toast(`${f.family} added. It goes out as an image so every inbox shows it.`, "success");
        } catch (err) {
          toast(err instanceof UploadError ? err.message : "That font couldn't be added.", "error");
        }
      }}
    />
  );
  return { el, open: () => input.current?.click() };
}

export function TextFormatBar({ b }: { b: Block }) {
  const design = useStudio((s) => s.doc!.design);
  const customFonts = useStudio((s) => s.doc!.customFonts);
  // What the block looks like, its text style included.
  const t = readTypo({ ...b, style: effectiveStyle(b.style, design) } as Block, design);
  const upload = useFontUpload((id) => set({ font: id }));
  const set = (change: TypoChange, key?: string) => updateBlock(b.id, setTypo(change, design), key ? `typo.${key}` : undefined);
  const toggle = (on: boolean, label: string, icon: React.ReactNode, change: TypoChange, testId: string) => (
    <button type="button" className="tf-btn" aria-pressed={on} title={label} aria-label={label} onClick={() => set(change)} data-testid={testId}>
      {icon}
    </button>
  );
  return (
    <div className="text-format" data-testid="text-format">
      <TextStyleRow b={b} />
      <FontPicker
        label="Font"
        value={t.font}
        onChange={(v) => set({ font: v })}
        testId="font-picker"
        custom={(customFonts ?? []).map((f) => f.family)}
        onUpload={upload.open}
      />
      {upload.el}
      {isCustomFont(t.font) && (b.type === "name" || b.type === "text") && (
        <Toggle
          label="Send as an image"
          hint="Your brand font isn't installed on recipients' devices; as an image, everyone sees it."
          checked={b.style?.asImage !== false}
          onChange={(v) => updateBlock(b.id, (x) => void (x.style = { ...x.style, asImage: v ? undefined : false }))}
          testId="as-image"
        />
      )}
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
