/**
 * The builder canvas: the real signature HTML (in a shadow root, exactly as
 * it will be sent) with selection, hover, a block toolbar and drop targets
 * drawn on top.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpLeft, Copy, GripVertical, Trash2 } from "lucide-react";
import { resizeSpec } from "./resize";
import { resizeKind, snapColumn, snapResize } from "./snap";
import { inlineTarget } from "./inlineText";
import { updateColumn } from "./actions";
import { findBlock, isWithin, rowOfColumn, walk } from "../core/blocks";
import type { Column } from "../core/types";
import { edit, ui, useStudio } from "../store/editor";
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
  const zoom = useStudio((s) => s.zoom);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [colRects, setColRects] = useState<Record<string, Rect>>({});
  const [guide, setGuide] = useState<{ x: number; y: number; h: number } | null>(null);
  const [inline, setInline] = useState<{ id: string; value: string; multiline: boolean } | null>(null);
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
    const cols: Record<string, Rect> = {};
    sr.querySelectorAll<HTMLElement>("[data-col]").forEach((el) => {
      // The column's cell, so the edge sits where the column really ends.
      const r = (el.closest("td") ?? el).getBoundingClientRect();
      cols[el.dataset.col!] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
    setColRects(cols);
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const sr = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    sr.innerHTML = SHADOW_CSS + html.replace(/<img /g, '<img part="img" ');
    measure();
  }, [html, measure, zoom]);

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
  const doc = useStudio((s) => s.doc);
  const spec = sel && selRect && doc ? resizeSpec(sel.block, doc, selRect.w / zoom) : null;
  const row = sel && root ? (sel.block.type === "row" ? sel.block : rowOfColumn(root, sel.parent.id)) : null;

  return (
    <div ref={stageRef} className={`stage ${className ?? ""}`} data-testid="stage">
      <div
        ref={hostRef}
        className="sig-host"
        data-testid="preview"
        style={{ zoom }}
        onDoubleClick={(e) => {
          const id = hit(e);
          if (!id) return;
          const st = useStudio.getState();
          const b = st.doc?.blocks ? findBlock(st.doc.blocks, id)?.block : null;
          const target = b && st.doc ? inlineTarget(b, st.doc) : null;
          if (target) {
            ui({ selected: id });
            return setInline({ id, value: target.value, multiline: target.multiline });
          }
          // Otherwise jump straight to the first thing to edit in the inspector.
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(".inspector textarea, .inspector input:not([type=checkbox]):not([type=range]), .inspector select")?.focus(),
          );
        }}
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
        {guide && <div className="ov-guide" style={{ left: guide.x, top: guide.y, height: guide.h }} />}
        {!dragging &&
          row &&
          row.columns.slice(0, -1).map((c) => {
            const r = colRects[c.id];
            const rr = rects[row.id];
            if (!r || !rr) return null;
            return (
              <button
                key={c.id}
                className="ov-col"
                style={{ left: r.x + r.w - 4, top: rr.y, height: rr.h }}
                title="Drag to set the column width · double-click for auto"
                aria-label="Column width"
                data-testid="col-handle"
                onDoubleClick={() => updateColumn(c.id, { width: undefined })}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const x0 = e.clientX;
                  const start = c.width ?? r.w / zoom;
                  const rowWidth = rr.w / zoom;
                  document.body.classList.add("is-col-resizing");
                  const move = (ev: PointerEvent) => {
                    const raw = Math.max(24, Math.min(rowWidth - 24, start + (ev.clientX - x0) / zoom));
                    const snap = ev.altKey ? { value: Math.round(raw) } : snapColumn(useStudio.getState().doc!.blocks!, c.id, raw, rowWidth);
                    updateColumn(c.id, { width: snap.value }, "w");
                    const edge = r.x + snap.value * zoom;
                    setGuide({ x: edge, y: rr.y - 8, h: rr.h + 16 });
                    const st = stageRef.current!.getBoundingClientRect();
                    setTip({ x: ev.clientX - st.left + 14, y: ev.clientY - st.top + 14, label: `${snap.value}px${snap.match ? ` · ${snap.match}` : ""}` });
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                    window.removeEventListener("pointercancel", up);
                    document.body.classList.remove("is-col-resizing");
                    setGuide(null);
                    setTip(null);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                  window.addEventListener("pointercancel", up);
                }}
              />
            );
          })}
        {inline && rects[inline.id] && (
          <InlineEditor
            rect={rects[inline.id]}
            value={inline.value}
            multiline={inline.multiline}
            onDone={(v) => {
              const id = inline.id;
              setInline(null);
              if (v === null) return;
              edit((d) => {
                const h = d.blocks ? findBlock(d.blocks, id) : null;
                const t = h ? inlineTarget(h.block, d) : null;
                if (h && t) t.apply(d, h.block, v);
              });
            }}
          />
        )}
        {tip && (
          <div className="ov-tip" style={{ left: tip.x, top: tip.y }}>
            {tip.label}
          </div>
        )}
        {hover && hover !== selected && rects[hover] && <div className="ov-hover" style={box(rects[hover])} />}
        {sel && selRect && !dragging && (
          <>
            <div className="ov-select" style={box(selRect)} />
            <button
              className="ov-grip"
              style={{ left: selRect.x - 22, top: selRect.y + selRect.h / 2 - 14 }}
              title="Drag to move"
              aria-label="Drag to move"
              data-testid="drag-handle"
              onPointerDown={(e) => {
                e.stopPropagation();
                armDrag(e, { kind: "move", id: sel.block.id }, blockLabel(sel.block));
              }}
            >
              <GripVertical size={14} />
            </button>
            {spec && (
              <button
                className={`ov-resize${spec.axis === "y" ? " v" : ""}`}
                style={
                  spec.axis === "y"
                    ? { left: selRect.x + selRect.w / 2 - 9, top: selRect.y + selRect.h - 9 }
                    : { left: selRect.x + selRect.w - 9, top: selRect.y + selRect.h - 9 }
                }
                title="Drag to resize"
                aria-label="Drag to resize"
                data-testid="resize-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const id = sel.block.id;
                  const x0 = e.clientX;
                  const y0 = e.clientY;
                  const w0 = Math.max(8, selRect.w);
                  const clamp = (v: number) => Math.min(spec.max, Math.max(spec.min, v));
                  document.body.classList.add("is-resizing");
                  const move = (ev: PointerEvent) => {
                    const raw =
                      spec.axis === "y" ? clamp(spec.start + (ev.clientY - y0) / zoom) : clamp(spec.start * Math.max(0.05, (w0 + ev.clientX - x0) / w0));
                    // Hold Alt to resize freely without snapping.
                    const snap = ev.altKey ? { value: raw } : snapResize(useStudio.getState().doc!, id, raw, resizeKind(sel.block));
                    const v = snap.value;
                    edit((d) => {
                      const h = d.blocks ? findBlock(d.blocks, id) : null;
                      if (h) spec.patch(v)(d, h.block);
                    }, `resize.${id}`);
                    const st = stageRef.current!.getBoundingClientRect();
                    setTip({
                      x: ev.clientX - st.left + 14,
                      y: ev.clientY - st.top + 14,
                      label: snap.match ? `${spec.label(v)} · matches ${snap.match}` : spec.label(v),
                    });
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                    window.removeEventListener("pointercancel", up);
                    document.body.classList.remove("is-resizing");
                    setTip(null);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                  window.addEventListener("pointercancel", up);
                }}
              />
            )}
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

/** Edit a block's text in place: Enter (or ⌘Enter for paragraphs) saves, Esc cancels. */
function InlineEditor({ rect, value, multiline, onDone }: { rect: Rect; value: string; multiline: boolean; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(value);
  const done = useRef(false);
  const finish = (out: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(out);
  };
  const props = {
    className: "ov-inline",
    value: v,
    autoFocus: true,
    "aria-label": "Edit text",
    "data-testid": "inline-editor",
    style: { left: rect.x - 4, top: rect.y - 4, width: Math.max(180, rect.w + 8), minHeight: rect.h + 8 },
    onFocus: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => e.currentTarget.select(),
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => finish(v),
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onKeyDown: (e: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; preventDefault: () => void }) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        finish(v);
      }
    },
  };
  return multiline ? <textarea {...props} rows={Math.max(2, v.split("\n").length)} /> : <input {...props} />;
}
