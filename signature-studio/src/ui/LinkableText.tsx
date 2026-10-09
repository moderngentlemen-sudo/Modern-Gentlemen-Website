/**
 * Rich text in a plain text box: select words, then Bold / Italic / Underline /
 * Strike / Highlight / Colour / Link from the mini toolbar (or ⌘B, ⌘I, ⌘U, ⌘K).
 * Stored as light markup (core/richtext.ts) that renders to Gmail-safe tags.
 * Smart typography (curly quotes, dashes, ellipsis) applies as you type, and
 * Backspace right after a replacement puts back what you typed.
 */
import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Bold, Highlighter, Italic, Link2, Palette, Strikethrough, Underline } from "lucide-react";
import { toast, useStudio } from "../store/editor";
import { colorWords, smartKey, toggleMark, type Mark } from "../core/richtext";

type TextEl = HTMLTextAreaElement | HTMLInputElement;

export function wrapLink(text: string, start: number, end: number, target: string): string {
  const words = text.slice(start, end).replace(/[[\]]/g, "");
  return `${text.slice(0, start)}[${words}](${target.trim()})${text.slice(end)}`;
}

const select = (el: RefObject<TextEl | null>, start: number, end: number) =>
  requestAnimationFrame(() => {
    el.current?.focus();
    el.current?.setSelectionRange(start, end);
  });

/** ⌘K/Link behaviour for any textarea or input. */
export function useLinker(el: RefObject<TextEl | null>, value: string, onChange: (v: string) => void) {
  const [range, setRange] = useState<[number, number] | null>(null);
  const [target, setTarget] = useState("");
  const start = () => {
    const node = el.current;
    if (!node) return;
    const a = node.selectionStart ?? 0;
    const b = node.selectionEnd ?? 0;
    if (a === b) return toast("Select the words you want to link first", "info");
    setRange([a, b]);
    setTarget("");
  };
  const close = () => {
    setRange(null);
    requestAnimationFrame(() => el.current?.focus());
  };
  const apply = () => {
    if (range && target.trim()) onChange(wrapLink(value, range[0], range[1], target));
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      start();
    }
  };
  const popover = range ? (
    <div className="link-pop" onPointerDown={(e) => e.stopPropagation()}>
      <span className="hint">Link “{value.slice(range[0], range[1]).slice(0, 30)}” to</span>
      <div className="row">
        <input
          className="input sm"
          autoFocus
          placeholder="Website, email or phone"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          aria-label="Link destination"
          data-testid="link-target"
        />
        <button className="btn sm primary" onMouseDown={(e) => e.preventDefault()} onClick={apply} data-testid="link-apply">
          Add link
        </button>
      </div>
    </div>
  ) : null;
  return { start, onKey, popover, open: !!range };
}

/** Mark toggling, colour and smart typography for a text box. */
export function useRichEditing(el: RefObject<TextEl | null>, value: string, onChange: (v: string) => void) {
  const last = useRef<{ text: string; caret: number; original: string; originalCaret: number } | null>(null);
  const [colours, setColours] = useState(false);
  const design = useStudio((s) => s.doc?.design);
  const sel = () => [el.current?.selectionStart ?? 0, el.current?.selectionEnd ?? 0] as const;
  const mark = (m: Mark) => {
    const [a, b] = sel();
    if (a === b) return toast("Select the words to format first", "info");
    const r = toggleMark(value, a, b, m);
    onChange(r.text);
    select(el, r.start, r.end);
  };
  const colour = (c: string) => {
    const [a, b] = sel();
    setColours(false);
    if (a === b) return toast("Select the words to colour first", "info");
    const r = colorWords(value, a, b, c);
    onChange(r.text);
    select(el, r.start, r.end);
  };
  /** Change handler: smart typography on single typed characters. */
  const change = (next: string, caret: number) => {
    const smart = smartKey(value, next, caret);
    if (smart) {
      last.current = { text: smart.text, caret: smart.caret, original: next, originalCaret: caret };
      onChange(smart.text);
      select(el, smart.caret, smart.caret);
      return;
    }
    // Backspace straight after a replacement puts back exactly what was typed.
    const undo = last.current;
    if (undo && value === undo.text && next.length < value.length && caret === undo.caret - 1) {
      last.current = null;
      onChange(undo.original);
      select(el, undo.originalCaret, undo.originalCaret);
      return;
    }
    last.current = null;
    onChange(next);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    const m: Mark | null = k === "b" ? "bold" : k === "i" ? "italic" : k === "u" ? "underline" : null;
    if (m) {
      e.preventDefault();
      mark(m);
    }
  };
  const palette = design ? [...new Set([design.accent, design.text, design.muted])] : [];
  const toolbar = (linkStart?: () => void) => (
    <div className="rich-bar" role="toolbar" aria-label="Format selected words" onMouseDown={(e) => e.preventDefault()} data-testid="rich-bar">
      <button type="button" title="Bold (⌘B)" aria-label="Bold selected words" onClick={() => mark("bold")} data-testid="rich-bold">
        <Bold size={14} />
      </button>
      <button type="button" title="Italic (⌘I)" aria-label="Italic selected words" onClick={() => mark("italic")}>
        <Italic size={14} />
      </button>
      <button type="button" title="Underline (⌘U)" aria-label="Underline selected words" onClick={() => mark("underline")}>
        <Underline size={14} />
      </button>
      <button type="button" title="Strikethrough" aria-label="Strike through selected words" onClick={() => mark("strike")}>
        <Strikethrough size={14} />
      </button>
      <button type="button" title="Highlight" aria-label="Highlight selected words" onClick={() => mark("highlight")} data-testid="rich-highlight">
        <Highlighter size={14} />
      </button>
      <span className="rich-colour">
        <button
          type="button"
          title="Colour"
          aria-label="Colour selected words"
          aria-expanded={colours}
          onClick={() => setColours(!colours)}
          data-testid="rich-colour"
        >
          <Palette size={14} />
        </button>
        {colours && (
          <span className="rich-colours" role="menu">
            {palette.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => colour(c)} />
            ))}
          </span>
        )}
      </span>
      {linkStart && (
        <button type="button" title="Link (⌘K)" aria-label="Link selected words" onClick={linkStart}>
          <Link2 size={14} />
        </button>
      )}
    </div>
  );
  return { change, onKey, toolbar };
}

export function LinkableText({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const linker = useLinker(ref, value, onChange);
  const rich = useRichEditing(ref, value, onChange);
  return (
    <div className="field">
      <label className="row" style={{ justifyContent: "space-between" }}>
        <span>{label}</span>
        <button
          type="button"
          className="btn sm ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={linker.start}
          title="Link selected words (⌘K)"
          data-testid="link-words"
        >
          <Link2 size={13} /> Link
        </button>
      </label>
      {rich.toolbar(linker.start)}
      <textarea
        ref={ref}
        className="textarea"
        value={value}
        spellCheck
        onChange={(e) => rich.change(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => {
          linker.onKey(e);
          rich.onKey(e);
        }}
        data-testid={testId}
      />
      {linker.popover}
      <span className="hint">Select words to format or link them. Quotes and dashes tidy themselves as you type.</span>
    </div>
  );
}
