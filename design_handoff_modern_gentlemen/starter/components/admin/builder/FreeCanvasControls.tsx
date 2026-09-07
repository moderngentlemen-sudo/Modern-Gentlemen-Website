"use client";
import { useEffect, useRef, type PointerEvent } from "react";
import type { BlockNode } from "@/lib/blocks/types";
import type { VisualStyle } from "@/lib/blocks/visual";
import { useBuilder } from "./StoreContext";
export function FreeCanvasControls({
  node,
  onPreview,
}: {
  node: BlockNode;
  onPreview: (value: VisualStyle | null) => void;
}) {
  const device = useBuilder((s) => s.device),
    commit = useBuilder((s) => s.setVisualStyle),
    snap = useBuilder((s) => s.snapToGrid);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    scale: number;
    edge: string;
    start: VisualStyle;
    next: VisualStyle;
  } | null>(null);
  useEffect(
    () => () => {
      gesture.current = null;
      onPreview(null);
    },
    [onPreview, device, node]
  );
  const bound = (n: number, min = -4000, max = 4000) => Math.min(max, Math.max(min, n));
  function start(e: PointerEvent<HTMLButtonElement>, edge: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const frame = e.currentTarget.closest<HTMLElement>("[data-block-key]");
    if (!frame) return;
    const rect = frame.getBoundingClientRect(),
      scale = rect.width / Math.max(1, frame.offsetWidth);
    const style = node.visual?.styles?.[device] ?? {};
    const base = {
      ...style,
      widthPx: style.widthPx ?? rect.width / scale,
      heightPx: style.heightPx ?? rect.height / scale,
      left: style.left ?? 0,
      top: style.top ?? 0,
    };
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      scale,
      edge,
      start: base,
      next: base,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const quantize = (n: number) => (snap && !e.altKey ? Math.round(n / 8) * 8 : Math.round(n));
    const dx = quantize((e.clientX - g.x) / g.scale),
      dy = quantize((e.clientY - g.y) / g.scale),
      s = g.start;
    let width = s.widthPx!,
      height = s.heightPx!,
      left = s.left!,
      top = s.top!;
    if (g.edge === "move") {
      left += dx;
      top += dy;
    } else {
      if (g.edge.includes("e")) width = bound(width + dx, 24);
      if (g.edge.includes("s")) height = bound(height + dy, 24);
      if (g.edge.includes("w")) {
        width = bound(width - dx, 24);
        left += s.widthPx! - width;
      }
      if (g.edge.includes("n")) {
        height = bound(height - dy, 24);
        top += s.heightPx! - height;
      }
    }
    g.next = {
      ...(g.edge === "move" ? node.visual?.styles?.[device] : s),
      position: s.position === "absolute" ? "absolute" : "relative",
      left: bound(left),
      top: bound(top),
      ...(g.edge === "move"
        ? {}
        : { widthPx: width, heightPx: height, widthPercent: undefined, width: undefined }),
    };
    onPreview(g.next);
  }
  function finish(e: PointerEvent<HTMLButtonElement>, cancel = false) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    onPreview(null);
    if (!cancel && g.next !== g.start) commit(node._key, device, g.next);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {["move", "nw", "n", "ne", "e", "se", "s", "sw", "w"].map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={edge === "move" ? "Move freely" : `Resize element ${edge}`}
          className="pointer-events-auto absolute min-h-4 min-w-4 border border-mg-accent bg-mg-surface text-xs"
          style={{
            left: edge.includes("w") ? 0 : edge.includes("e") ? "100%" : "50%",
            top: edge.includes("s")
              ? "100%"
              : edge === "move"
                ? -24
                : edge.includes("n")
                  ? 0
                  : "50%",
            transform: "translate(-50%, -50%)",
            touchAction: "none",
            cursor: edge === "move" ? "move" : edge + "-resize",
          }}
          onPointerDown={(e) => start(e, edge)}
          onPointerMove={move}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              gesture.current = null;
              onPreview(null);
            }
          }}
        >
          {edge === "move" ? "Move" : ""}
        </button>
      ))}
    </div>
  );
}
