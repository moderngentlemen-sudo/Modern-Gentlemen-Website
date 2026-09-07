"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { produce } from "immer";
import type { BlockNode } from "@/lib/blocks/types";
import { findBlock } from "@/lib/blocks/traverse";
import { useBuilder } from "./StoreContext";

type Preview = { key: string; path: (string | number)[]; value: string; baseline: BlockNode };
const Context = createContext<{
  modern: boolean;
  setModern: (value: boolean) => void;
  preview: (path: (string | number)[], value: string | null) => void;
  renderNode: (node: BlockNode) => BlockNode;
}>({ modern: false, setModern: () => {}, preview: () => {}, renderNode: (node) => node });

/** Editor-only state. It never enters payload(), autosave, or document history. */
export function EditorExperience({ children }: { children: ReactNode }) {
  const [modern, setMode] = useState(false);
  const [hover, setHover] = useState<Preview | null>(null);
  const selected = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);
  useEffect(() => setHover(null), [tree, selected]);
  const node = selected ? findBlock(tree, selected) : undefined;
  return (
    <Context.Provider
      value={{
        modern,
        setModern: (value) => {
          setHover(null);
          setMode(value);
        },
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

export function EditorExperienceSwitch() {
  const { modern, setModern } = useEditorExperience();
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-mg-bd/20 bg-mg-surface px-4 py-2"
      role="group"
      aria-label="Builder experience"
    >
      <button
        type="button"
        aria-pressed={!modern}
        onClick={() => setModern(false)}
        className="border border-mg-bd/30 px-3 py-2 text-sm"
      >
        Original builder
      </button>
      <button
        type="button"
        aria-pressed={modern}
        onClick={() => setModern(true)}
        className="border border-mg-bd/30 px-3 py-2 text-sm"
      >
        Canvas builder · Preview
      </button>
      <span className="text-xs text-mg-fg/70">
        Same document · Switch editors without converting your page
      </span>
    </div>
  );
}
