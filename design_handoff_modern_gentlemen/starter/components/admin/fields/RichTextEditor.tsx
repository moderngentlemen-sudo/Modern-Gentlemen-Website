"use client";

import { useId, useRef, useState } from "react";

import { RichTextContent } from "@/components/ui/RichTextContent";
import { clsx } from "@/components/ui/clsx";
import { CONTROL, FOCUS_RING, LABEL_SM } from "@/components/admin/ui/styles";
import { FieldShell } from "@/components/admin/ui/Input";

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const TOOL_BUTTON = clsx(
  "min-w-8 border border-mg-bd/20 px-2 py-1 font-mono text-[11px] text-mg-fg transition-colors",
  "hover:border-mg-accent hover:text-mg-accentInk disabled:cursor-not-allowed disabled:opacity-40",
  FOCUS_RING
);

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  help,
  error,
  required,
  disabled,
}: RichTextEditorProps) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start, end);
    });
  };

  const wrapSelection = (before: string, after: string, fallback: string) => {
    const control = textarea.current;
    if (!control) return;
    const start = control.selectionStart;
    const end = control.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    restoreSelection(start + before.length, start + before.length + selected.length);
  };

  const prefixLines = (prefix: string) => {
    const control = textarea.current;
    if (!control) return;
    const selectionStart = control.selectionStart;
    const selectionEnd = control.selectionEnd;
    const start = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const end = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(start, end).split("\n");
    const remove = lines.every((line) => !line.trim() || line.startsWith(prefix));
    const formatted = lines
      .map((line) =>
        remove
          ? line.replace(new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`), "")
          : line
            ? `${prefix}${line}`
            : line
      )
      .join("\n");
    onChange(`${value.slice(0, start)}${formatted}${value.slice(end)}`);
    restoreSelection(start, start + formatted.length);
  };

  return (
    <FieldShell
      label={label}
      help={help ?? "Use the toolbar or Markdown shortcuts. Raw HTML is displayed as text."}
      error={error}
      required={required}
      htmlFor={id}
    >
      <div className="border border-mg-bd/20" data-invalid={error ? "" : undefined}>
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          className="flex flex-wrap items-center gap-1 border-b border-mg-bd/15 bg-mg-fg/[0.025] p-2"
        >
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Bold"
            onClick={() => wrapSelection("**", "**", "bold text")}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Italic"
            onClick={() => wrapSelection("*", "*", "italic text")}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Link"
            onClick={() => wrapSelection("[", "](/)", "link text")}
          >
            Link
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Heading"
            onClick={() => prefixLines("## ")}
          >
            H2
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Quote"
            onClick={() => prefixLines("> ")}
          >
            Quote
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={disabled}
            aria-label="Bulleted list"
            onClick={() => prefixLines("- ")}
          >
            List
          </button>
          <button
            type="button"
            className={clsx(
              TOOL_BUTTON,
              "ml-auto",
              preview && "border-mg-accent text-mg-accentInk"
            )}
            disabled={disabled}
            aria-pressed={preview}
            onClick={() => setPreview((current) => !current)}
          >
            Preview
          </button>
        </div>
        <textarea
          ref={textarea}
          id={id}
          rows={10}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-required={required || undefined}
          className={clsx(CONTROL, "resize-y border-0 leading-relaxed focus:ring-0")}
        />
        {preview && (
          <div className="border-t border-mg-bd/15 p-4" aria-label={`${label} preview`}>
            <div className={LABEL_SM}>Preview</div>
            <RichTextContent value={value} className="mt-3 text-[14px] leading-relaxed" />
          </div>
        )}
      </div>
    </FieldShell>
  );
}
