"use client";
import { useRef, type PointerEvent, type KeyboardEvent } from "react";
import { gridPlacement, shiftGrid, type GridPlacement } from "@/lib/blocks/grid";
import type { BlockNode } from "@/lib/blocks/types";
import { useBuilder } from "./StoreContext";

function measurePlacement(element: HTMLElement, placement: GridPlacement) {
  const frame = element.closest<HTMLElement>("[data-block-key]");
  const grid = frame?.parentElement?.closest<HTMLElement>("[data-grid-layout]");
  if (!frame || !grid) return null;
  const rect = grid.getBoundingClientRect(),
    item = frame.getBoundingClientRect();
  const scale = rect.width / Math.max(1, grid.offsetWidth);
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  const stepX = Math.max(1, (rect.width + gap * scale) / 12);
  // Measured row tracks include content-driven expansion; use the current row's size.
  const tracks = getComputedStyle(grid).gridTemplateRows.split(" ").map(Number.parseFloat);
  const rowGap = parseFloat(getComputedStyle(grid).rowGap) || 0;
  let row = 1,
    offset = 0;
  while (
    row < tracks.length &&
    offset + (tracks[row - 1] + rowGap) * scale <= item.top - rect.top + 1
  ) {
    offset += (tracks[row - 1] + rowGap) * scale;
    row++;
  }
  const resolved = {
    ...placement,
    column: placement.column || Math.max(1, Math.round((item.left - rect.left) / stepX) + 1),
    row: placement.row || row,
  };
  return { resolved, stepX, stepY: Math.max(1, ((tracks[row - 1] || 48) + rowGap) * scale) };
}

export function GridControls({
  node,
  onPreview,
}: {
  node: BlockNode;
  onPreview: (p: GridPlacement | null) => void;
}) {
  const device = useBuilder((s) => s.device);
  const commit = useBuilder((s) => s.setGridPlacement);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    stepX: number;
    stepY: number;
    start: GridPlacement;
    next: GridPlacement;
    resize: boolean;
  } | null>(null);
  const placement = gridPlacement(node.visual?.grid, device);
  function start(e: PointerEvent<HTMLButtonElement>, resize: boolean) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const measured = measurePlacement(e.currentTarget, placement);
    if (!measured) return;
    const { resolved, stepX, stepY } = measured;
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      stepX,
      stepY,
      start: resolved,
      next: resolved,
      resize,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    g.next = shiftGrid(
      g.start,
      Math.round((e.clientX - g.x) / g.stepX),
      Math.round((e.clientY - g.y) / g.stepY),
      g.resize
    );
    onPreview(g.next);
  }
  function finish(e: PointerEvent<HTMLButtonElement>, cancel = false) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    onPreview(null);
    if (
      !cancel &&
      (g.next.column !== g.start.column ||
        g.next.row !== g.start.row ||
        g.next.span !== g.start.span ||
        g.next.rows !== g.start.rows)
    )
      commit(node._key, device, g.next);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function key(e: KeyboardEvent<HTMLButtonElement>, resize: boolean) {
    if (e.key === "Escape") {
      gesture.current = null;
      onPreview(null);
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!delta[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
    const [x, y] = delta[e.key];
    commit(
      node._key,
      device,
      shiftGrid(measurePlacement(e.currentTarget, placement)?.resolved ?? placement, x, y, resize)
    );
  }
  return (
    <div className="pointer-events-none absolute bottom-1 left-1 z-40 flex gap-1">
      {([false, true] as const).map((resize) => (
        <button
          key={String(resize)}
          type="button"
          aria-label={resize ? "Resize grid element" : "Move grid element"}
          title="Drag or use arrow keys. Escape cancels a drag."
          className="pointer-events-auto min-h-8 min-w-8 border border-mg-accent bg-mg-bg px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-mg-accent"
          style={{ touchAction: "none", cursor: resize ? "nwse-resize" : "move" }}
          onPointerDown={(e) => start(e, resize)}
          onPointerMove={move}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
          onKeyDown={(e) => key(e, resize)}
        >
          {resize ? "Resize" : "Move"}
        </button>
      ))}
    </div>
  );
}
export function GridPlacementEditor({ node }: { node: BlockNode }) {
  const device = useBuilder((s) => s.device),
    commit = useBuilder((s) => s.setGridPlacement);
  const p = gridPlacement(node.visual?.grid, device);
  return (
    <fieldset disabled={node.locked} className="space-y-3 border-b border-mg-bd/20 p-4">
      <legend className="pt-3 text-sm font-medium">Grid placement — {device}</legend>
      <p className="text-xs text-mg-fg/70">
        12 columns. Zero places a row or column automatically. Explicit positions may overlap;
        reading order stays in the Navigator.
      </p>
      {(
        [
          ["column", "Column", 0, 12],
          ["row", "Row", 0, 100],
          ["span", "Column span", 1, 12],
          ["rows", "Row span", 1, 40],
        ] as const
      ).map(([property, label, min, max]) => (
        <label key={property} className="flex items-center justify-between gap-2 text-sm">
          {label}
          <input
            aria-label={label}
            type="number"
            min={min}
            max={max}
            step={1}
            value={p[property]}
            className="w-20 border border-mg-bd/30 bg-mg-bg p-1"
            onChange={(e) => {
              const value = e.currentTarget.valueAsNumber;
              if (!Number.isInteger(value)) return;
              const next = { ...p, [property]: Math.max(min, Math.min(max, value)) };
              if (next.column > 0) next.span = Math.min(next.span, 13 - next.column);
              commit(node._key, device, next);
            }}
          />
        </label>
      ))}
      <button
        type="button"
        className="text-sm underline"
        onClick={() => commit(node._key, device, undefined)}
      >
        Reset this device
      </button>
    </fieldset>
  );
}
