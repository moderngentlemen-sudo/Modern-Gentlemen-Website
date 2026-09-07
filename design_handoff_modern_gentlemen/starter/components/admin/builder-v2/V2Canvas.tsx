"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { registry } from "@/components/sections/registry";
import { BlockDesignFrame } from "@/components/BlockDesignFrame";
import { VisualElementFrame } from "@/components/VisualElementFrame";
import { PagePresentation } from "@/components/PagePresentation";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";
import { gridPlacement, gridPosition } from "@/lib/blocks/grid";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";
import type { VisualStyle } from "@/lib/blocks/visual";
import { useBuilder, useBuilderStore } from "../builder/StoreContext";
import { useEditorExperience } from "../builder/EditorExperience";
import { usePattern } from "../builder/PatternsContext";
import { BlockErrorBoundary } from "../builder/BlockErrorBoundary";
import { HANDLES, alignMove, gestureStyle, type Handle, type Rect } from "./geometry";

const WIDTH = { desktop: 1440, tablet: 834, mobile: 390 };
const DOCUMENT =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"></body></html>';

/** CSS viewport and interaction boundary, independent of the Original canvas. */
export function V2Canvas() {
  const device = useBuilder((s) => s.device),
    zoom = useBuilder((s) => s.canvasZoom);
  const frame = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  useEffect(() => {
    if (!doc) return;
    function sync() {
      if (!doc) return;
      doc.head.querySelectorAll("[data-v2-style]").forEach((n) => n.remove());
      document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach((n) => {
        const clone = n.cloneNode(true) as Element;
        clone.setAttribute("data-v2-style", "");
        doc.head.appendChild(clone);
      });
      doc.documentElement.className = document.documentElement.className;
      doc.body.className = document.body.className;
      doc.documentElement.setAttribute(
        "data-mgtheme",
        document.documentElement.getAttribute("data-mgtheme") ?? "light"
      );
    }
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [doc]);
  return (
    <div style={{ width: WIDTH[device] * zoom, height: 850 * zoom }} className="relative mx-auto">
      <iframe
        ref={frame}
        title="Builder V2 canvas"
        srcDoc={DOCUMENT}
        onLoad={() => setDoc(frame.current?.contentDocument ?? null)}
        className="absolute left-0 top-0 border border-mg-bd/20 bg-mg-bg"
        style={{
          width: WIDTH[device],
          height: 850,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      />
      {doc && createPortal(<Scene />, doc.body)}
    </div>
  );
}

function Scene() {
  const tree = useBuilder((s) => s.tree),
    settings = useBuilder((s) => s.doc.rest.pageSettings);
  const store = useBuilderStore();
  const { renderPage } = useEditorExperience();
  return (
    <div
      data-v2-scene
      tabIndex={0}
      onKeyDown={(e) => {
        const state = store.getState();
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) state.redo();
          else state.undo();
        } else if (e.key === "Escape") {
          e.preventDefault();
          state.select(null);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          state.removeSelected();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-mg-block")) e.preventDefault();
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData("application/x-mg-block");
        if (!manifestFor(type)) return;
        e.preventDefault();
        e.stopPropagation();
        store.getState().insert(type);
      }}
    >
      <PagePresentation preview settings={renderPage(settings)}>
        <Nodes nodes={tree} />
      </PagePresentation>
      {!tree.length && (
        <p className="p-12 text-center text-sm text-mg-fg/70">
          Add a section from the library or drop one here.
        </p>
      )}
    </div>
  );
}

function Nodes({ nodes, inGrid = false }: { nodes: BlockTree; inGrid?: boolean }) {
  return (
    <>
      {nodes.map((node) => (
        <Node key={node._key} node={node} inGrid={inGrid} />
      ))}
    </>
  );
}
function Node({ node, inGrid }: { node: BlockNode; inGrid: boolean }) {
  const store = useBuilderStore();
  const device = useBuilder((s) => s.device),
    selected = useBuilder((s) => s.selectedKeys.includes(node._key));
  const single = useBuilder((s) => s.selectedKeys.length === 1);
  const { renderNode } = useEditorExperience();
  const pattern = usePattern(node._ref);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<VisualStyle | null>(null);
  const source = renderNode(node);
  const Component = registry[node._type as keyof typeof registry] as
    ComponentType<Record<string, unknown>> | undefined;
  const slot = manifestFor(node._type)?.slot;
  const hidden =
    node.visibility?.hidden ||
    (node.visibility?.devices && !node.visibility.devices.includes(device));
  useEffect(() => setPreview(null), [node, device]);
  return (
    <div
      ref={setFrame}
      data-v2-block={node._key}
      className="relative"
      style={{
        ...(inGrid ? gridPosition(gridPlacement(node.visual?.grid, device)) : {}),
        ...(hidden ? { opacity: 0.4 } : {}),
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        store.getState().select(node._key, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
    >
      <div inert={!slot && !node._ref ? true : undefined}>
        <BlockDesignFrame design={source.design}>
          <VisualElementFrame
            blockKey={node._key}
            visual={
              preview
                ? { ...source.visual, styles: { ...source.visual?.styles, [device]: preview } }
                : source.visual
            }
          >
            {node._ref ? (
              <div className="border border-mg-bd/30 p-8">
                <p>Synced pattern · {pattern?.name ?? "Unavailable reference"}</p>
                <button
                  type="button"
                  disabled={!pattern || node.locked}
                  onClick={() =>
                    pattern && store.getState().detachPatternRef(node._key, pattern.blocks)
                  }
                >
                  Detach a copy
                </button>
              </div>
            ) : Component ? (
              <BlockErrorBoundary type={node._type}>
                <Component
                  {...normalizeBlock(source)}
                  {...(node._type === "gridLayout" || node._type === "widgetStudio"
                    ? { previewDevice: device }
                    : {})}
                >
                  {slot ? (
                    <Nodes nodes={node.children ?? []} inGrid={node._type === "gridLayout"} />
                  ) : undefined}
                </Component>
              </BlockErrorBoundary>
            ) : (
              <p className="border border-mg-accent p-8">
                Unsupported block: {node._type}. Data is retained.
              </p>
            )}
          </VisualElementFrame>
        </BlockDesignFrame>
      </div>
      {selected && (
        <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-mg-accent" />
      )}
      {selected && single && !node.locked && !inGrid && (
        <Selection node={node} frame={frame} preview={preview} onPreview={setPreview} />
      )}
      {selected && inGrid && (
        <span className="absolute left-0 top-0 bg-mg-surface p-1 text-xs">
          Grid item · adjust placement in inspector
        </span>
      )}
    </div>
  );
}

function surface(frame: HTMLElement) {
  return (
    [...frame.querySelectorAll<HTMLElement>("[data-mg-visual]")].find(
      (e) => e.closest("[data-v2-block]") === frame
    ) ?? frame
  );
}
function Selection({
  node,
  frame,
  preview,
  onPreview,
}: {
  node: BlockNode;
  frame: HTMLElement | null;
  preview: VisualStyle | null;
  onPreview: (style: VisualStyle | null) => void;
}) {
  const store = useBuilderStore();
  const device = useBuilder((s) => s.device),
    snap = useBuilder((s) => s.snapToGrid);
  const [rect, setRect] = useState<Rect | null>(null);
  const [guide, setGuide] = useState<{ x?: number; y?: number } | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    handle: Handle;
    rect: Rect;
    style: VisualStyle;
    next: VisualStyle | null;
    peers: Rect[];
  } | null>(null);
  useLayoutEffect(() => {
    if (!frame) return;
    const update = () => {
      const r = surface(frame).getBoundingClientRect();
      setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(surface(frame));
    frame.ownerDocument.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      frame.ownerDocument.removeEventListener("scroll", update, true);
    };
  }, [frame, node, preview, device]);
  useEffect(
    () => () => {
      gesture.current = null;
      onPreview(null);
    },
    [device, node, onPreview]
  );
  function start(e: ReactPointerEvent<HTMLButtonElement>, handle: Handle) {
    if (!frame || !rect || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const peers = [...(frame.parentElement?.children ?? [])]
      .filter((el) => el !== frame && el.hasAttribute("data-v2-block"))
      .map((el) => {
        const r = surface(el as HTMLElement).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      handle,
      rect,
      peers,
      style: node.visual?.styles?.[device] ?? {},
      next: null,
    };
  }
  function move(e: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const step = snap && !e.altKey ? 8 : 1;
    let dx = Math.round((e.clientX - g.x) / step) * step,
      dy = Math.round((e.clientY - g.y) / step) * step;
    setGuide(null);
    if (snap && !e.altKey && g.handle === "move") {
      const a = alignMove({ ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy }, g.peers);
      dx += a.dx;
      dy += a.dy;
      setGuide(a);
    }
    g.next = gestureStyle(g.style, g.rect, g.handle, dx, dy);
    onPreview(g.next);
  }
  function finish(e: ReactPointerEvent<HTMLButtonElement>, cancel: boolean) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setGuide(null);
    onPreview(null);
    if (!cancel && g.next)
      store.getState().setVisualStyle(node._key, device, g.next, { discrete: true });
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  if (!rect || !frame) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 border border-mg-accent"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      {guide?.x !== undefined && (
        <div
          aria-hidden
          className="absolute -bottom-8 -top-8 border-l border-mg-accent"
          style={{ left: guide.x - rect.x }}
        />
      )}
      {guide?.y !== undefined && (
        <div
          aria-hidden
          className="absolute -left-8 -right-8 border-t border-mg-accent"
          style={{ top: guide.y - rect.y }}
        />
      )}
      {(["move", ...HANDLES] as const).map((handle) => (
        <button
          type="button"
          key={handle}
          aria-label={handle === "move" ? "V2 move element" : `V2 resize ${handle}`}
          className="pointer-events-auto absolute min-h-5 min-w-5 border border-mg-accent bg-mg-surface text-xs"
          style={{
            left:
              handle === "move"
                ? "50%"
                : handle.includes("w")
                  ? 0
                  : handle.includes("e")
                    ? "100%"
                    : "50%",
            top:
              handle === "move"
                ? 12
                : handle.includes("n")
                  ? 0
                  : handle.includes("s")
                    ? "100%"
                    : "50%",
            transform: "translate(-50%, -50%)",
            touchAction: "none",
            cursor: handle === "move" ? "move" : `${handle}-resize`,
          }}
          onPointerDown={(e) => start(e, handle)}
          onPointerMove={move}
          onPointerUp={(e) => finish(e, false)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              gesture.current = null;
              onPreview(null);
              setGuide(null);
            }
          }}
        >
          {handle === "move" ? "Move" : ""}
        </button>
      ))}
    </div>,
    frame.ownerDocument.body
  );
}
