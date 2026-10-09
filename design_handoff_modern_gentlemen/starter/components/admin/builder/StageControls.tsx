"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import {
  boundStage,
  dragStage,
  nudgeStage,
  snapStage,
  stagePlacement,
  type StageDevice,
  type StagePlacement,
} from "@/lib/blocks/stage";
import { STAGE_DESIGN_WIDTH } from "@/lib/blocks/stage";
import { findBlock } from "@/lib/blocks/traverse";
import type { BlockNode } from "@/lib/blocks/types";

import { useBuilder, useBuilderStore } from "./StoreContext";
import { locate } from "./tree";

type Edge = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Box = { x: number; y: number; w: number; h: number };

const HANDLES: { edge: Exclude<Edge, "move">; left: string; top: string; cursor: string }[] = [
  { edge: "nw", left: "0", top: "0", cursor: "nwse-resize" },
  { edge: "ne", left: "100%", top: "0", cursor: "nesw-resize" },
  { edge: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { edge: "sw", left: "0", top: "100%", cursor: "nesw-resize" },
  { edge: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { edge: "w", left: "0", top: "50%", cursor: "ew-resize" },
];

const HANDLE_LABEL: Record<string, string> = {
  nw: "Scale from the top left",
  ne: "Scale from the top right",
  se: "Scale from the bottom right",
  sw: "Scale from the bottom left",
  e: "Change the width from the right",
  w: "Change the width from the left",
};

function isTyping(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']") !== null
  );
}

/**
 * Direct manipulation for one element on a Stage.
 *
 * The whole element is a drag surface: press anywhere and drag to move it,
 * which selects it at the same time. Once selected, the corners scale it
 * proportionally (text and all) and the sides change its wrap width. Moves
 * snap to the stage's centre lines and edges and to other elements (hold Alt
 * to place freely). Arrow keys nudge by 0.5%, Shift+arrow by 5%.
 *
 * Every gesture previews locally and commits **once** on release, so a drag is
 * one undo step and autosave sees one change. Edits apply to the device being
 * previewed; tablet and phone fall back to the larger layout until edited.
 */
export function StageControls({
  node,
  index,
  mobileFree,
  selected,
  label,
  onPreview,
}: {
  node: BlockNode;
  index: number;
  mobileFree: boolean;
  selected: boolean;
  label: string;
  onPreview: (placement: StagePlacement | null) => void;
}) {
  const store = useBuilderStore();
  const device = useBuilder((s) => s.device) as StageDevice;
  const snap = useBuilder((s) => s.snapToGrid);
  const [guides, setGuides] = useState<{ v?: number; h?: number; layer: HTMLElement } | null>(null);
  const [live, setLive] = useState<StagePlacement | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    edge: Edge;
    start: StagePlacement;
    next: StagePlacement;
    box: Box;
    peers: Box[];
    layer: HTMLElement;
    moved: boolean;
  } | null>(null);

  const placement = stagePlacement(node.visual?.stage, device, { index, mobileFree });

  // Arrow keys nudge the selected element; a run of presses is one undo step.
  useEffect(() => {
    if (!selected || !placement) return;
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const d = delta[event.key];
      if (!d) return;
      const state = store.getState();
      if (state.selectedKeys.length !== 1 || state.selectedKey !== node._key) return;
      // Read the placement now, not from the render: two presses inside one
      // frame would otherwise both nudge from the same starting point.
      const live =
        stagePlacement(findBlock(state.tree, node._key)?.visual?.stage, device, {
          index,
          mobileFree,
        }) ?? placement!;
      event.preventDefault();
      state.setStagePlacement(node._key, device, nudgeStage(live, d[0], d[1], event.shiftKey), {
        coalesce: true,
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, placement, store, node._key, device, index, mobileFree]);

  useEffect(
    () => () => {
      gesture.current = null;
      onPreview(null);
    },
    // The element's identity, not the node object: the first phone drag on a
    // stacked stage rewrites this node mid-gesture, and that must not end it.
    [onPreview, device, node._key]
  );

  // Phones stack in reading order until the stage is set to free placement.
  // A drag there is still welcome: it switches the stage's phones to free
  // placement first, seeded from where everything sits in the stack.
  const stacked = !placement && device === "mobile" && !mobileFree;
  if (!placement && !stacked) return null;
  const locked = node.locked === true;

  /**
   * Phone placements for every element on this stage, measured from the
   * stacked layout so nothing moves when the stage switches to free placement.
   * Stacked elements draw at their phone scale in CSS pixels; placed ones are
   * scaled with the stage (width / 1440), so the scale is converted to keep
   * each element the size it was.
   */
  function seedPhones(layer: HTMLElement): Record<string, StagePlacement> | null {
    const state = store.getState();
    const where = locate(state.tree, node._key);
    const stage = where?.parentKey ? findBlock(state.tree, where.parentKey) : undefined;
    if (!stage || stage._type !== "stageLayout") return null;
    const L = layer.getBoundingClientRect();
    const perDesignPx = layer.offsetWidth / STAGE_DESIGN_WIDTH;
    if (L.width < 1 || L.height < 1 || perDesignPx <= 0) return null;
    const placements: Record<string, StagePlacement> = {};
    (stage.children ?? []).forEach((child, i) => {
      const frame = layer.querySelector<HTMLElement>(
        `:scope > [data-block-key="${CSS.escape(child._key)}"]`
      );
      if (!frame) return;
      const r = frame.getBoundingClientRect();
      const stackScale = child.visual?.stage?.mobile?.scale ?? 1;
      const scale = stackScale / perDesignPx;
      placements[child._key] = boundStage({
        x: ((r.left - L.left) / L.width) * 100,
        y: ((r.top - L.top) / L.height) * 100,
        w: ((r.width / L.width) * 100) / scale,
        scale,
        z: child.visual?.stage?.desktop?.z ?? i + 1,
      });
    });
    return placements;
  }

  function start(event: ReactPointerEvent<HTMLElement>, edge: Edge) {
    if (event.button !== 0 || locked) return;
    const state = store.getState();
    if (edge === "move" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      // Modifier clicks build a multi-selection instead of dragging.
      state.select(node._key, true);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedKeys.includes(node._key) || state.selectedKeys.length > 1)
      state.select(node._key);
    const frame = event.currentTarget.closest<HTMLElement>("[data-block-key]");
    const layer = frame?.offsetParent;
    if (!frame || !(layer instanceof HTMLElement)) return;
    let start = placement;
    if (stacked) {
      if (edge !== "move") return;
      const seeded = seedPhones(layer);
      const parentKey = locate(state.tree, node._key)?.parentKey;
      if (!seeded || !parentKey || !seeded[node._key]) return;
      state.placeStageOnPhones(parentKey, seeded);
      start = seeded[node._key];
    }
    if (!start) return;
    const L = layer.getBoundingClientRect();
    if (L.width < 1 || L.height < 1) return;
    const toBox = (r: DOMRect): Box => ({
      x: ((r.left - L.left) / L.width) * 100,
      y: ((r.top - L.top) / L.height) * 100,
      w: (r.width / L.width) * 100,
      h: (r.height / L.height) * 100,
    });
    const peers = [...layer.children]
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== frame)
      .filter((el) => el.hasAttribute("data-block-key"))
      .map((el) => toBox(el.getBoundingClientRect()));
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: L.width,
      height: L.height,
      edge,
      start,
      next: start,
      box: toBox(frame.getBoundingClientRect()),
      peers,
      layer,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const px = event.clientX - g.x;
    const py = event.clientY - g.y;
    if (!g.moved && Math.hypot(px, py) < 3) return;
    g.moved = true;
    const dx = (px / g.width) * 100;
    const dy = (py / g.height) * 100;
    let next = dragStage(g.start, g.edge, dx, dy, g.box.h);
    if (g.edge === "move" && snap && !event.altKey) {
      const s = snapStage({ ...g.box, x: next.x, y: next.y }, g.peers, 0.8);
      next = boundStage({ ...next, x: s.x, y: s.y });
      setGuides(
        s.vertical !== undefined || s.horizontal !== undefined
          ? { v: s.vertical, h: s.horizontal, layer: g.layer }
          : null
      );
    }
    g.next = next;
    setLive(next);
    onPreview(next);
  }

  function finish(event: ReactPointerEvent<HTMLElement>, cancel = false) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    setGuides(null);
    setLive(null);
    onPreview(null);
    if (!cancel && g.moved) store.getState().setStagePlacement(node._key, device, g.next);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const shown = live ?? placement;
  const pointer = (edge: Edge) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, edge),
    onPointerMove: move,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
  });

  return (
    <>
      {!locked && (
        <div
          aria-hidden="true"
          data-stage-move=""
          className="absolute inset-0 z-[5] cursor-move"
          style={{ touchAction: "none" }}
          title={stacked ? "Drag to place freely on phones" : undefined}
          {...pointer("move")}
        />
      )}
      {selected && !locked && stacked && (
        <div
          className="pointer-events-none absolute left-0 top-full z-[9] mt-2 whitespace-nowrap bg-[#141414] px-2 py-0.5 font-mono text-[10px] text-white"
          data-stage-readout=""
        >
          {label} · stacked on phones · drag to place freely
        </div>
      )}
      {selected && !locked && shown && placement && (
        <>
          {HANDLES.map((h) => (
            <button
              key={h.edge}
              type="button"
              aria-label={HANDLE_LABEL[h.edge]}
              className="absolute z-[9] h-3 w-3 border border-mg-accent bg-mg-surface"
              style={{
                left: h.left,
                top: h.top,
                transform: "translate(-50%, -50%)",
                touchAction: "none",
                cursor: h.cursor,
                borderRadius: h.edge.length === 2 ? 0 : 999,
              }}
              {...pointer(h.edge)}
            />
          ))}
          <div
            className="pointer-events-auto absolute left-0 top-full z-[9] mt-2 flex items-center gap-1 whitespace-nowrap bg-[#141414] px-1 py-0.5 font-mono text-[10px] text-white"
            data-stage-readout=""
          >
            <span className="px-1" aria-live="polite">
              {label} · {Math.round(shown.x)}%, {Math.round(shown.y)}% · ×{shown.scale.toFixed(2)}
              {device !== "desktop" && ` · ${device}`}
            </span>
            <button
              type="button"
              className="px-1 hover:bg-white/15"
              aria-label="Bring forward"
              title="Bring forward"
              onClick={() =>
                store
                  .getState()
                  .setStagePlacement(
                    node._key,
                    device,
                    boundStage({ ...placement, z: placement.z + 1 })
                  )
              }
            >
              ▲
            </button>
            <button
              type="button"
              className="px-1 hover:bg-white/15"
              aria-label="Send backward"
              title="Send backward"
              onClick={() =>
                store
                  .getState()
                  .setStagePlacement(
                    node._key,
                    device,
                    boundStage({ ...placement, z: placement.z - 1 })
                  )
              }
            >
              ▼
            </button>
          </div>
        </>
      )}
      {guides &&
        createPortal(
          <>
            {guides.v !== undefined && (
              <div
                aria-hidden="true"
                data-stage-guide="vertical"
                className="pointer-events-none absolute bottom-0 top-0 z-[60] border-l border-mg-accent"
                style={{ left: `${guides.v}%` }}
              />
            )}
            {guides.h !== undefined && (
              <div
                aria-hidden="true"
                data-stage-guide="horizontal"
                className="pointer-events-none absolute left-0 right-0 z-[60] border-t border-mg-accent"
                style={{ top: `${guides.h}%` }}
              />
            )}
          </>,
          guides.layer
        )}
    </>
  );
}

/**
 * Exact placement for one element on a Stage, for the device being previewed.
 * Dragging covers most edits; this is for precise numbers, centring and
 * resetting a device back to its fallback.
 */
export function StagePlacementEditor({
  node,
  index,
  mobileFree,
}: {
  node: BlockNode;
  index: number;
  mobileFree: boolean;
}) {
  const device = useBuilder((s) => s.device) as StageDevice;
  const commit = useBuilder((s) => s.setStagePlacement);
  const p = stagePlacement(node.visual?.stage, device, { index, mobileFree });
  const own = node.visual?.stage?.[device] !== undefined;
  if (!p)
    return (
      <div className="border-b border-mg-bd/20 p-4 text-[12px] text-mg-fg/70">
        On phones this stage stacks its elements in reading order. Drag any element on the canvas to
        place them freely on phones instead — everything starts where it sits now.
      </div>
    );
  const field = (property: "x" | "y" | "w" | "scale" | "z", label: string, step: number) => (
    <label key={property} className="flex items-center justify-between gap-2 text-[13px]">
      {label}
      <input
        aria-label={label}
        type="number"
        step={step}
        value={property === "scale" ? p[property] : Math.round(p[property] * 10) / 10}
        disabled={node.locked}
        className="w-24 border border-mg-bd/30 bg-mg-bg p-1 text-right"
        onChange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (!Number.isFinite(value)) return;
          commit(node._key, device, boundStage({ ...p, [property]: value }), { coalesce: true });
        }}
      />
    </label>
  );
  return (
    <fieldset
      disabled={node.locked}
      className="space-y-2 border-b border-mg-bd/20 p-4"
      data-stage-placement-editor=""
    >
      <legend className="pt-3 text-sm font-medium">Position on the stage — {device}</legend>
      <p className="text-[12px] text-mg-fg/70">
        Drag the element on the page, or set exact values. Percentages are of the stage, so the
        layout keeps its proportions on every screen.
        {device !== "desktop" &&
          !own &&
          " This device is following the larger layout until you change something."}
      </p>
      {field("x", "Left (%)", 0.5)}
      {field("y", "Top (%)", 0.5)}
      {field("w", "Width (%)", 0.5)}
      {field("scale", "Scale", 0.05)}
      {field("z", "Layer (higher is in front)", 1)}
      <div className="flex flex-wrap gap-3 pt-1 text-[12px]">
        <button
          type="button"
          className="underline"
          onClick={() =>
            commit(node._key, device, boundStage({ ...p, x: 50 - (p.w * p.scale) / 2 }))
          }
        >
          Centre across
        </button>
        {own && (
          <button
            type="button"
            className="underline"
            onClick={() => commit(node._key, device, undefined)}
          >
            {device === "desktop" ? "Reset position" : `Reset ${device} to follow larger screens`}
          </button>
        )}
      </div>
    </fieldset>
  );
}
