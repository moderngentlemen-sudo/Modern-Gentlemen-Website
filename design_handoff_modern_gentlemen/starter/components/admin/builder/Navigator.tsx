"use client";

import { useState } from "react";

import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING } from "@/components/admin/ui/styles";
import { manifestFor } from "@/lib/blocks/manifests";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

import { useBuilder } from "./StoreContext";

/**
 * The document hierarchy, independent of the canvas geometry.
 *
 * Once containers may hold containers, selecting by clicking the rendered
 * result is not enough: an empty container has little surface, overlapping
 * wrappers are ambiguous, and deeply nested blocks need an exact route. The
 * navigator reads the canonical tree rather than constructing another model,
 * so selection can never point at an element that does not exist in the page.
 */
export function Navigator() {
  const tree = useBuilder((state) => state.tree);
  const selectedKey = useBuilder((state) => state.selectedKey);
  const select = useBuilder((state) => state.select);
  const hover = useBuilder((state) => state.hover);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (tree.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12px] leading-relaxed text-mg-fg/60">
        The hierarchy will appear here as you add elements.
      </p>
    );
  }

  return (
    <nav aria-label="Page hierarchy" className="overflow-y-auto py-2">
      <TreeList
        nodes={tree}
        depth={0}
        selectedKey={selectedKey}
        collapsed={collapsed}
        onSelect={select}
        onHover={hover}
        onToggle={toggle}
      />
    </nav>
  );
}

function TreeList({
  nodes,
  depth,
  selectedKey,
  collapsed,
  onSelect,
  onHover,
  onToggle,
}: {
  nodes: BlockTree;
  depth: number;
  selectedKey: string | null;
  collapsed: ReadonlySet<string>;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
  onToggle: (key: string) => void;
}) {
  return (
    <ul role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => (
        <TreeItem
          key={node._key}
          node={node}
          depth={depth}
          selected={selectedKey === node._key}
          collapsed={collapsed}
          onSelect={onSelect}
          onHover={onHover}
          onToggle={onToggle}
          selectedKey={selectedKey}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  selected,
  collapsed,
  onSelect,
  onHover,
  onToggle,
  selectedKey,
}: {
  node: BlockNode;
  depth: number;
  selected: boolean;
  collapsed: ReadonlySet<string>;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
  onToggle: (key: string) => void;
  selectedKey: string | null;
}) {
  const manifest = manifestFor(node._type);
  const children = node.children ?? [];
  const isContainer = manifest?.slot !== undefined;
  const isCollapsed = collapsed.has(node._key);
  const label = node.visual?.name || manifest?.label || node._type;

  return (
    <li
      role="treeitem"
      aria-selected={selected}
      aria-expanded={isContainer ? !isCollapsed : undefined}
    >
      <div
        className={clsx(
          "group flex min-w-0 items-center pr-2",
          selected ? "bg-mg-accent/10 text-mg-accentInk" : "hover:bg-mg-fg/5"
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
        onMouseEnter={() => onHover(node._key)}
        onMouseLeave={() => onHover(null)}
      >
        {isContainer ? (
          <button
            type="button"
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${label}`}
            onClick={() => onToggle(node._key)}
            className={clsx("h-7 w-6 shrink-0 text-[11px]", FOCUS_RING)}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span aria-hidden="true" className="w-6 shrink-0 text-center text-[8px] text-mg-fg/40">
            ◆
          </span>
        )}

        <button
          type="button"
          onClick={() => onSelect(node._key)}
          aria-current={selected ? "true" : undefined}
          className={clsx("min-w-0 flex-1 truncate py-2 text-left text-[12px]", FOCUS_RING)}
        >
          {label}
        </button>

        {node.visibility?.hidden && (
          <span className="ml-1 font-mono text-[9px] uppercase text-mg-fg/50">Hidden</span>
        )}
        {node.locked && (
          <span aria-label="Locked" className="ml-1 text-[10px] text-mg-fg/50">
            ●
          </span>
        )}
      </div>

      {children.length > 0 && !isCollapsed && (
        <TreeList
          nodes={children}
          depth={depth + 1}
          selectedKey={selectedKey}
          collapsed={collapsed}
          onSelect={onSelect}
          onHover={onHover}
          onToggle={onToggle}
        />
      )}
    </li>
  );
}
