"use client";
import { useEffect, useLayoutEffect, useState, useRef, type PointerEvent } from "react";
import type { BlockNode } from "@/lib/blocks/types";
import type { VisualStyle } from "@/lib/blocks/visual";
import { snapFreeRect, type CanvasRect, type SnapResult } from "./freeSnap";
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
  const overlay = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<SnapResult | null>(null);
  function surface(frame: HTMLElement) {
    return (
      [...frame.querySelectorAll<HTMLElement>("[data-mg-visual]")].find(
        (e) => e.closest("[data-block-key]") === frame
      ) ?? frame
    );
  }
  useLayoutEffect(() => {
    const el = overlay.current,
      frame = el?.closest<HTMLElement>("[data-block-key]");
    if (!el || !frame) return;
    const update = () => {
      const outer = frame.getBoundingClientRect(),
        inner = surface(frame).getBoundingClientRect(),
        scale = outer.width / Math.max(1, frame.offsetWidth);
      if (!scale) return;
      Object.assign(el.style, {
        left: (inner.left - outer.left) / scale + "px",
        top: (inner.top - outer.top) / scale + "px",
        width: inner.width / scale + "px",
        height: inner.height / scale + "px",
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(surface(frame));
    return () => observer.disconnect();
  });
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    scale: number;
    edge: string;
    start: VisualStyle;
    next: VisualStyle;
    rect: CanvasRect;
    peers: CanvasRect[];
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
    const outer = frame.getBoundingClientRect(),
      rect = surface(frame).getBoundingClientRect(),
      scale = outer.width / Math.max(1, frame.offsetWidth);
    if (!scale) return;
    const geometry = (r: DOMRect): CanvasRect => ({
      x: r.left / scale,
      y: r.top / scale,
      width: r.width / scale,
      height: r.height / scale,
    });
    const peers = [...(frame.parentElement?.children ?? [])]
      .filter(
        (e): e is HTMLElement =>
          e instanceof HTMLElement && e !== frame && e.hasAttribute("data-block-key")
      )
      .map((e) => geometry(surface(e).getBoundingClientRect()));
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
      rect: geometry(rect),
      peers,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const quantize = (n: number) => (snap && !e.altKey ? Math.round(n / 8) * 8 : Math.round(n));
    let dx = quantize((e.clientX - g.x) / g.scale),
      dy = quantize((e.clientY - g.y) / g.scale);
    const s = g.start;
    setGuides(null);
    if (g.edge === "move" && snap && !e.altKey) {
      const matched = snapFreeRect(
        { ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy },
        g.peers,
        6 / g.scale
      );
      dx = matched.x - g.rect.x;
      dy = matched.y - g.rect.y;
      setGuides(matched);
    }
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
    setGuides(null);
    onPreview(null);
    if (!cancel && g.next !== g.start) commit(node._key, device, g.next);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <div ref={overlay} className="pointer-events-none absolute left-0 top-0 z-40">
      {guides?.vertical !== undefined && (
        <div
          aria-hidden="true"
          className="absolute -bottom-4 -top-4 border-l border-mg-accent"
          style={{ left: guides.vertical - guides.x }}
        />
      )}
      {guides?.horizontal !== undefined && (
        <div
          aria-hidden="true"
          className="absolute -left-4 -right-4 border-t border-mg-accent"
          style={{ top: guides.horizontal - guides.y }}
        />
      )}
      {guides?.gap !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -bottom-6 bg-mg-surface px-1 text-xs text-mg-accentInk"
        >
          Equal spacing · {Math.round(guides.gap)}px
        </span>
      )}
      {["move", "nw", "n", "ne", "e", "se", "s", "sw", "w"].map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={edge === "move" ? "Move freely" : `Resize element ${edge}`}
          className="pointer-events-auto absolute min-h-4 min-w-4 border border-mg-accent bg-mg-surface text-xs"
          style={{
            left:
              edge === "move"
                ? "50%"
                : edge.includes("w")
                  ? 0
                  : edge.includes("e")
                    ? "100%"
                    : "50%",
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
              setGuides(null);
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
