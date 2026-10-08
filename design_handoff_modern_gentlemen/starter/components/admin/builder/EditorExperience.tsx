"use client";

import type { Gradient } from "@/lib/domain/gradient";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { produce } from "immer";
import type { BlockNode } from "@/lib/blocks/types";
import { findBlock } from "@/lib/blocks/traverse";
import { useBuilder } from "./StoreContext";

type Preview = { key: string; path: (string | number)[]; value: unknown; baseline: BlockNode };

/**
 * The three editor experiences over one document.
 *
 * **Focus** is the unified editor: Canvas Preview's live previews and handles
 * in a canvas-first layout (rail, fly-out panes, floating inspector). It is the
 * default. **Original** and **Canvas Preview** stay selectable until the owner
 * signs off on Focus; none of the three converts or saves anything differently.
 * `modern` is true for Focus and Canvas, which is what every preview-aware
 * control already reads.
 */
export type EditorMode = "focus" | "original" | "canvas";
export const EDITOR_MODES: readonly { mode: EditorMode; label: string }[] = [
  { mode: "focus", label: "Focus" },
  { mode: "original", label: "Original builder" },
  { mode: "canvas", label: "Canvas builder · Preview" },
];
/** Owned by the builder. Per browser: a layout preference, never document data. */
export const EDITOR_MODE_KEY = "mg-editor-experience";
function storedMode(): EditorMode | null {
  try {
    const value = window.localStorage.getItem(EDITOR_MODE_KEY);
    return value === "focus" || value === "original" || value === "canvas" ? value : null;
  } catch {
    return null;
  }
}

const Context = createContext<{
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  modern: boolean;
  setModern: (value: boolean) => void;
  preview: (path: (string | number)[], value: unknown) => void;
  previewPage: (value: unknown) => void;
  renderPage: (value: unknown) => unknown;
  renderNode: (node: BlockNode) => BlockNode;
}>({
  previewPage: () => {},
  renderPage: (value) => value,
  mode: "original",
  setMode: () => {},
  modern: false,
  setModern: () => {},
  preview: () => {},
  renderNode: (node) => node,
});

/** Editor-only state. It never enters payload(), autosave, or document history. */
export function EditorExperience({
  children,
  initialMode,
}: {
  children: ReactNode;
  /** Fixes the starting mode (tests, embeds). Otherwise the browser's saved choice, else Focus. */
  initialMode?: EditorMode;
}) {
  const [mode, setModeState] = useState<EditorMode>(initialMode ?? "focus");
  const modern = mode !== "original";
  // Read after mount so the server render and the first client render agree.
  useEffect(() => {
    if (initialMode) return;
    const saved = storedMode();
    if (saved) setModeState(saved);
  }, [initialMode]);
  const [hover, setHover] = useState<Preview | null>(null);
  const [pageHover, setPageHover] = useState<{ baseline: unknown; value: unknown } | null>(null);
  const pageSettings = useBuilder((s) => s.doc.rest.pageSettings);
  useEffect(() => setPageHover(null), [pageSettings]);
  const selected = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);
  useEffect(() => setHover(null), [tree, selected]);
  const node = selected ? findBlock(tree, selected) : undefined;
  const changeMode = (next: EditorMode) => {
    setHover(null);
    setPageHover(null);
    setModeState(next);
    try {
      window.localStorage.setItem(EDITOR_MODE_KEY, next);
    } catch {
      // Private windows may refuse storage; the choice simply lasts this visit.
    }
  };
  return (
    <Context.Provider
      value={{
        mode,
        setMode: changeMode,
        modern,
        previewPage: (value) =>
          setPageHover(value === null ? null : { baseline: pageSettings, value }),
        renderPage: (value) =>
          modern && pageHover && pageHover.baseline === value
            ? { ...(value as object), backgroundGradient: pageHover.value }
            : value,
        setModern: (value) => changeMode(value ? "canvas" : "original"),
        preview: (path, value) => {
          if (!modern || !node || value === null) {
            setHover(null);
            return;
          }
          setHover({ key: node._key, path, value, baseline: node });
        },
        renderNode: (source) => {
          if (!modern || !hover || hover.key !== selected || source !== hover.baseline)
            return source;
          return produce(source, (draft) => {
            if (hover.path[0] === "$gradient") {
              draft.design ??= {};
              draft.design.gradient = hover.value as Gradient;
              return;
            }
            draft.settings ??= {};
            let target = draft.settings as Record<string | number, unknown>;
            if (
              !target ||
              hover.path.some((p) => ["__proto__", "constructor", "prototype"].includes(String(p)))
            )
              return;
            hover.path.forEach((part, index) => {
              if (index === hover.path.length - 1) target[part] = hover.value;
              else {
                if (!target[part] || typeof target[part] !== "object") target[part] = {};
                target = target[part] as Record<string | number, unknown>;
              }
            });
          });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useEditorExperience = () => useContext(Context);

export function EditorExperienceSwitch({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useEditorExperience();
  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-1"
          : "flex flex-wrap items-center gap-3 border-b border-mg-bd/20 bg-mg-surface px-4 py-2"
      }
      role="group"
      aria-label="Builder experience"
    >
      {EDITOR_MODES.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={mode === option.mode}
          onClick={() => setMode(option.mode)}
          className={
            compact
              ? "border border-mg-bd/30 px-2 py-1 text-xs aria-pressed:bg-mg-fg aria-pressed:text-mg-bg"
              : "border border-mg-bd/30 px-3 py-2 text-sm aria-pressed:bg-mg-fg aria-pressed:text-mg-bg"
          }
        >
          {option.label}
        </button>
      ))}
      {!compact && (
        <span className="text-xs text-mg-fg/70">
          Same document · Switch editors without converting your page
        </span>
      )}
    </div>
  );
}
