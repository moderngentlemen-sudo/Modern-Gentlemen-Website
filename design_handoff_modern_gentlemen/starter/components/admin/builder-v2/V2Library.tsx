"use client";
import { useState } from "react";
import { blockCatalogFor } from "@/components/sections/registry";
import { manifestFor } from "@/lib/blocks/manifests";
import { findBlock } from "@/lib/blocks/traverse";
import type { BlockTree } from "@/lib/blocks/types";
import type { BuilderPattern } from "../builder/Builder";
import { useBuilder, useBuilderStore } from "../builder/StoreContext";
import { locate } from "../builder/tree";
import { WidgetLibrary } from "../builder/WidgetLibrary";

export function V2Library({ patterns }: { patterns: BuilderPattern[] }) {
  const [tab, setTab] = useState<"elements" | "layers" | "widgets" | "patterns">("elements");
  const [query, setQuery] = useState("");
  const store = useBuilderStore();
  const tree = useBuilder((s) => s.tree);
  const type = useBuilder((s) => s.doc.type);
  function insert(type: string) {
    const s = store.getState(),
      selected = s.selectedKey ? findBlock(s.tree, s.selectedKey) : undefined;
    const slot = selected ? manifestFor(selected._type)?.slot : undefined;
    if (selected && !selected.locked && slot && (!slot.allow || slot.allow.includes(type)))
      s.insert(type, undefined, selected._key);
    else {
      const at = s.selectedKey ? locate(s.tree, s.selectedKey) : null;
      s.insert(type, at ? at.index + 1 : undefined, at?.parentKey ?? null);
    }
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-1 border-b border-mg-bd/20 p-2">
        {(["elements", "layers", "widgets", "patterns"] as const).map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className="border border-mg-bd/20 px-2 py-2 text-xs"
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "widgets" ? (
        <WidgetLibrary />
      ) : tab === "layers" ? (
        <Layers nodes={tree} />
      ) : tab === "patterns" ? (
        <div className="space-y-2 p-3">
          {patterns.map((p) => (
            <button
              type="button"
              key={p.id}
              className="block w-full border border-mg-bd/20 p-3 text-left text-sm"
              onClick={() =>
                p.syncMode === "synced"
                  ? store.getState().insertPatternRef(p.id)
                  : store.getState().insertMany(p.blocks)
              }
            >
              {p.name}
              <span className="block text-xs text-mg-fg/70">{p.syncMode}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-3">
          <input
            aria-label="Find elements"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-3 w-full border border-mg-bd/30 bg-mg-surface p-2 text-sm"
            placeholder="Find elements or sections"
          />
          {blockCatalogFor(type)
            .filter((b) =>
              `${b.label} ${b.description}`.toLowerCase().includes(query.toLowerCase())
            )
            .map((b) => (
              <button
                type="button"
                key={b.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-mg-block", b.type)}
                onClick={() => insert(b.type)}
                className="mb-2 block w-full border border-mg-bd/20 p-3 text-left text-sm"
              >
                <strong>{b.label}</strong>
                <span className="mt-1 block text-xs text-mg-fg/70">{b.description}</span>
              </button>
            ))}
        </div>
      )}
    </>
  );
}
function Layers({ nodes }: { nodes: BlockTree }) {
  const store = useBuilderStore();
  const selected = useBuilder((s) => s.selectedKeys);
  return (
    <ul className="space-y-2 p-2">
      {nodes.map((n) => (
        <li key={n._key} className="border-l border-mg-bd/20 pl-2">
          <button
            type="button"
            aria-pressed={selected.includes(n._key)}
            onClick={(e) => store.getState().select(n._key, e.shiftKey)}
            className="w-full p-2 text-left text-sm"
          >
            {manifestFor(n._type)?.label ?? n._type}
            {n.locked ? " · locked" : ""}
          </button>
          <div className="flex gap-2 text-xs">
            {([-1, 1] as const).map((delta) => (
              <button
                type="button"
                key={delta}
                disabled={n.locked}
                aria-label={`${delta < 0 ? "Move up" : "Move down"} ${n._key}`}
                onClick={() => {
                  const at = locate(store.getState().tree, n._key);
                  if (at)
                    store
                      .getState()
                      .moveTo(n._key, at.parentKey, Math.max(0, at.index + (delta < 0 ? -1 : 2)));
                }}
              >
                {delta < 0 ? "↑" : "↓"}
              </button>
            ))}
            <button type="button" onClick={() => store.getState().setLocked(n._key, !n.locked)}>
              {n.locked ? "Unlock" : "Lock"}
            </button>
            <button
              type="button"
              disabled={n.locked}
              onClick={() => store.getState().duplicate(n._key)}
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={n.locked}
              onClick={() => store.getState().remove(n._key)}
            >
              Delete
            </button>
          </div>
          {n.children && <Layers nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}
