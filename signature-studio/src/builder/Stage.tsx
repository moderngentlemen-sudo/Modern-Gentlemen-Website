/**
 * The builder canvas: the real signature HTML (in a shadow root, exactly as
 * it will be sent) with selection, hover, a block toolbar and drop targets
 * drawn on top.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpLeft, Copy, GripVertical, Trash2 } from "lucide-react";
import { findBlock, isWithin, rowOfColumn, walk } from "../core/blocks";
import type { Column } from "../core/types";
import { ui, useStudio } from "../store/editor";
import { duplicateSelected, nudgeSelected, removeSelected, selectParent } from "./actions";
import { blockLabel } from "./catalog";
import { armDrag, registerResolver, useDrag, type Resolution } from "./dnd";

type Rect = { x: number; y: number; w: number; h: number };

const SHADOW_CSS = `<style>
:host{display:block}
a{cursor:default}
[data-block]{position:relative}
[data-col]{min-height:24px}
</style>`;

function allColumns(root: Column): Column[] {
  const out = [root];
  for (const { block } of walk(root)) if (block.type === "row") out.push(...block.columns);
  return out;
}

export function Stage({ html, className }: { html: string; className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const selected = useStudio((s) => s.selected);
  const root = useStudio((s) => s.doc?.blocks);
  const dragging = useDrag((s) => !!s.source);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [hover, setHover] = useState<string | null>(null);

  const shadow = () => hostRef.current?.shadowRoot ?? null;

  const measure = useCallback(() => {
    const sr = shadow();
    const stage = stageRef.current;
    if (!sr || !stage) return;
    const base = stage.getBoundingClientRect();
    const next: Record<string, Rect> = {};
    sr.querySelectorAll<HTMLElement>("[data-block]").forEach((el) => {
      const r = el.getBoundingClientRect();
      next[el.dataset.block!] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const sr = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    sr.innerHTML = SHADOW_CSS + html.replace(/<img /g, '<img part="img" ');
    measure();
  }, [html, measure]);

  useEffect(() => {
    const host = hostRef.current!;
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);
    const onLoad = () => measure();
    host.shadowRoot?.addEventListener("load", onLoad, true);
    window.addEventListener("resize", onLoad);
    // Links inside the signature must not navigate while editing.
    const noNav = (e: Event) => e.preventDefault();
    host.addEventListener("click", noNav);
    return () => {
      ro.disconnect();
      host.shadowRoot?.removeEventListener("load", onLoad, true);
      window.removeEventListener("resize", onLoad);
      host.removeEventListener("click", noNav);
    };
  }, [measure]);

  // Drop targets: the deepest column under the pointer, then the slot between its blocks.
  useEffect(
    () =>
      registerResolver((x, y, source): Resolution | null => {
        const sr = shadow();
        const doc = useStudio.getState().doc;
        const host = hostRef.current;
        if (!sr || !doc?.blocks || !host) return null;
        const hb = host.getBoundingClientRect();
        const pad = 48;
        if (x < hb.left - pad || x > hb.right + pad || y < hb.top - pad || y > hb.bottom + pad) return null;
        const tree = doc.blocks;
        let best: { col: Column; r: DOMRect } | null = null;
        for (const c of allColumns(tree)) {
          if (source.kind === "move" && isWithin(tree, source.id, c.id)) continue;
          const el = sr.querySelector<HTMLElement>(`[data-col="${CSS.escape(c.id)}"]`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const inside = x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
          if (inside && (!best || r.width * r.height < best.r.width * best.r.height)) best = { col: c, r };
        }
        if (!best) {
          const el = sr.querySelector<HTMLElement>(`[data-col="${CSS.escape(tree.id)}"]`);
          if (!el) return null;
          best = { col: tree, r: el.getBoundingClientRect() };
        }
        const { col, r } = best;
        const kids = col.blocks
          .filter((b) => !(source.kind === "move" && b.id === source.id))
          .map((b) => ({ b, el: sr.querySelector<HTMLElement>(`[data-block="${CSS.escape(b.id)}"]`) }))
          .filter((k) => k.el);
        let index = col.blocks.length;
        let lineY = r.top + r.height / 2;
        for (const k of kids) {
          const kr = k.el!.getBoundingClientRect();
          if (y < kr.top + kr.height / 2) {
            index = col.blocks.indexOf(k.b);
            lineY = kr.top - 3;
            break;
          }
          lineY = kr.bottom + 3;
        }
        return {
          target: { columnId: col.id, index },
          indicator: { x: r.left, y: lineY, width: Math.max(r.width, 60), box: { x: r.left, y: r.top, w: r.width, h: r.height } },
        };
      }),
    [],
  );

  const hit = (e: { nativeEvent: Event }): string | null => {
    for (const n of e.nativeEvent.composedPath()) {
      const el = n as HTMLElement;
      if (el === hostRef.current) break;
      if (el.dataset?.block) return el.dataset.block;
    }
    return null;
  };

  const sel = selected && root ? findBlock(root, selected) : null;
  const selRect = selected ? rects[selected] : null;
  const canParent = !!(sel && root && rowOfColumn(root, sel.parent.id));

  return (
    <div ref={stageRef} className={`stage ${className ?? ""}`} data-testid="stage">
      <div
        ref={hostRef}
        className="sig-host"
        data-testid="preview"
        onPointerMove={(e) => !dragging && setHover(hit(e))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const id = hit(e);
          if (!id) return ui({ selected: null });
          if (e.pointerType === "touch") return ui({ selected: id });
          const b = root ? findBlock(root, id)?.block : null;
          armDrag(e, { kind: "move", id }, b ? blockLabel(b) : "Block", () => ui({ selected: id }));
        }}
      />
      <div className="stage-overlay" aria-hidden={!sel}>
        {hover && hover !== selected && rects[hover] && <div className="ov-hover" style={box(rects[hover])} />}
        {sel && selRect && !dragging && (
          <>
            <div className="ov-select" style={box(selRect)} />
            <div
              className="ov-toolbar"
              style={{ left: selRect.x, top: selRect.y < 32 ? selRect.y + selRect.h + 6 : selRect.y - 32 }}
              role="toolbar"
              aria-label="Block actions"
            >
              <button
                className="ov-handle"
                title="Drag to move"
                aria-label="Drag to move"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  armDrag(e, { kind: "move", id: sel.block.id }, blockLabel(sel.block));
                }}
              >
                <GripVertical size={14} />
              </button>
              <span className="ov-name">{blockLabel(sel.block)}</span>
              {canParent && (
                <button onClick={selectParent} title="Select the columns around it" aria-label="Select parent">
                  <ArrowUpLeft size={14} />
                </button>
              )}
              <button onClick={() => nudgeSelected(-1)} title="Move up (Alt+↑)" aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => nudgeSelected(1)} title="Move down (Alt+↓)" aria-label="Move down">
                <ArrowDown size={14} />
              </button>
              <button onClick={duplicateSelected} title="Duplicate (⌘D)" aria-label="Duplicate">
                <Copy size={14} />
              </button>
              <button onClick={removeSelected} title="Delete (Del)" aria-label="Delete" data-testid="delete-block">
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const box = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h });

/** Ghost + drop indicator while dragging (portal, viewport coordinates). */
export function DragLayer() {
  const { source, label, x, y, resolution } = useDrag();
  if (!source) return null;
  return createPortal(
    <>
      {resolution && (
        <>
          <div
            className="dnd-col"
            style={{ left: resolution.indicator.box.x, top: resolution.indicator.box.y, width: resolution.indicator.box.w, height: resolution.indicator.box.h }}
          />
          <div className="dnd-line" style={{ left: resolution.indicator.x, top: resolution.indicator.y - 1, width: resolution.indicator.width }} />
        </>
      )}
      <div className="dnd-ghost" style={{ left: x + 12, top: y + 12 }}>
        {label}
      </div>
    </>,
    document.body,
  );
}
