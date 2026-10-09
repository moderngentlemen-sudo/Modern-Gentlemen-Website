/**
 * The builder canvas: the real signature HTML (in a shadow root, exactly as
 * it will be sent) with selection, hover, a block toolbar and drop targets
 * drawn on top.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpLeft, Copy, GripVertical, Trash2 } from "lucide-react";
import { HANDLE_CURSOR, handlesFor, resizeSpec, resizeValue, type HandleDir } from "./resize";

const DIR_NAME: Record<HandleDir, string> = {
  n: "top",
  s: "bottom",
  e: "right",
  w: "left",
  ne: "top right",
  nw: "top left",
  se: "bottom right",
  sw: "bottom left",
};
import { resizeKind, snapColumn, snapResize } from "./snap";
import { toolbarTop } from "./toolbar";
import { inlineTarget } from "./inlineText";
import { useLinker } from "../ui/LinkableText";
import { updateColumn } from "./actions";
import { findBlock, isWithin, rowOfColumn, walk } from "../core/blocks";
import type { Block, Column } from "../core/types";
import { edit, ui, useStudio, tree, treeOf } from "../store/editor";
import { duplicateSelected, nudgeSelected, removeSelected, selectParent, toggleInSelection } from "./actions";
import { blockLabel } from "./catalog";
import { armDrag, registerResolver, useDrag, type Resolution } from "./dnd";

type Rect = { x: number; y: number; w: number; h: number };

const SHADOW_CSS = `<style>
:host{display:block}
a{cursor:default}
a[href]{transition:background-color .15s}
a[href]:hover{background-color:rgba(108,85,255,.12);outline:1px dashed rgba(108,85,255,.7);outline-offset:1px;border-radius:2px}
[data-block]{position:relative}
[data-col]{min-height:24px}
</style>`;

/** First field worth typing into: never a colour picker, a slider or a switch. */
const FIRST_FIELD = "textarea, input:not([type=checkbox]):not([type=range]):not([type=color]), select";

const focusFirst = (scope: string) =>
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(scope)?.querySelector<HTMLElement>(FIRST_FIELD)?.focus()));

/**
 * Double-click on a block without text of its own: do the thing people most
 * likely want — change or crop an image, edit contact details or social links —
 * instead of focusing whatever input happens to come first.
 */
export function primaryAction(b: Block) {
  const doc = useStudio.getState().doc;
  switch (b.type) {
    case "photo":
    case "logo": {
      const has = !!doc?.images[b.type].assetId;
      if (has) ui({ dialog: "crop", dialogArg: b.type });
      else ui({ tab: "images" });
      return;
    }
    case "image":
      if (b.assetId) ui({ dialog: "crop", dialogArg: `block:${b.id}` });
      else requestAnimationFrame(() => document.querySelector<HTMLElement>(".inspector .image-drop")?.click());
      return;
    case "contacts":
      ui({ tab: "details" });
      // Land on the contact lines, not the name at the top of the form.
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="field-phone"]')?.focus()));
      return;
    case "socials":
      ui({ tab: "social" });
      return;
    default:
      focusFirst(".inspector");
  }
}

function allColumns(root: Column): Column[] {
  const out = [root];
  for (const { block } of walk(root)) if (block.type === "row") out.push(...block.columns);
  return out;
}

export function Stage({ html, className }: { html: string; className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const selected = useStudio((s) => s.selected);
  const multi = useStudio((s) => s.multi);
  const root = useStudio(treeOf);
  const dragging = useDrag((s) => !!s.source);
  const zoom = useStudio((s) => s.zoom);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [colRects, setColRects] = useState<Record<string, Rect>>({});
  const [guide, setGuide] = useState<{ x: number; y: number; h: number } | null>(null);
  const [inline, setInline] = useState<{ id: string; value: string; multiline: boolean; linkable?: boolean } | null>(null);
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

  // Enter on a selected block: edit its text in place, or do its main action.
  useEffect(() => {
    const onEdit = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const st = useStudio.getState();
      const b = st.doc ? findBlock(tree(st.doc), id)?.block : null;
      if (!b || !st.doc) return;
      const target = inlineTarget(b, st.doc);
      if (target) setInline({ id, value: target.value, multiline: target.multiline, linkable: target.linkable });
      else primaryAction(b);
    };
    window.addEventListener("signet:edit-block", onEdit);
    return () => window.removeEventListener("signet:edit-block", onEdit);
  }, []);

  // Drop targets: the deepest column under the pointer, then the slot between its blocks.
  useEffect(
    () =>
      registerResolver((x, y, source): Resolution | null => {
        const sr = shadow();
        const doc = useStudio.getState().doc;
        const host = hostRef.current;
        const root = doc ? tree(doc) : undefined;
        if (!sr || !root || !host) return null;
        const hb = host.getBoundingClientRect();
        const pad = 48;
        if (x < hb.left - pad || x > hb.right + pad || y < hb.top - pad || y > hb.bottom + pad) return null;
        let best: { col: Column; r: DOMRect } | null = null;
        for (const c of allColumns(root)) {
          if (source.kind === "move" && isWithin(root, source.id, c.id)) continue;
          const el = sr.querySelector<HTMLElement>(`[data-col="${CSS.escape(c.id)}"]`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const inside = x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
          if (inside && (!best || r.width * r.height < best.r.width * best.r.height)) best = { col: c, r };
        }
        if (!best) {
          const el = sr.querySelector<HTMLElement>(`[data-col="${CSS.escape(root.id)}"]`);
          if (!el) return null;
          best = { col: root, r: el.getBoundingClientRect() };
        }
        const { col, r } = best;
        const kids = col.blocks
          .filter((b) => !(source.kind === "move" && b.id === source.id))
          .map((b) => ({ b, el: sr.querySelector<HTMLElement>(`[data-block="${CSS.escape(b.id)}"]`) }))
          .filter((k) => k.el);
        // Near a block's left or right edge: place side by side.
        for (const k of kids) {
          if (k.b.type === "row") continue;
          const kr = k.el!.getBoundingClientRect();
          if (y < kr.top || y > kr.bottom) continue;
          let right = kr.left;
          for (const ch of Array.from(k.el!.querySelectorAll<HTMLElement>("td, img, a, span"))) right = Math.max(right, ch.getBoundingClientRect().right);
          right = Math.min(right, kr.right);
          const edge = Math.min(36, Math.max(14, (right - kr.left) * 0.2));
          const side = x <= kr.left + edge && x >= kr.left - 24 ? "left" : x >= right - edge && x <= right + 40 ? "right" : null;
          if (!side) continue;
          const lx = side === "left" ? kr.left - 3 : right + 3;
          return {
            target: { columnId: col.id, index: col.blocks.indexOf(k.b), beside: { id: k.b.id, side } },
            indicator: { x: lx, y: kr.top, width: 3, height: kr.height, box: { x: kr.left, y: kr.top, w: right - kr.left, h: kr.height } },
          };
        }
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
          const t = st.doc ? tree(st.doc) : undefined;
          const b = t ? findBlock(t, id)?.block : null;
          const target = b && st.doc ? inlineTarget(b, st.doc) : null;
          if (target) {
            ui({ selected: id });
            return setInline({ id, value: target.value, multiline: target.multiline, linkable: target.linkable });
          }
          if (b) {
            ui({ selected: id });
            primaryAction(b);
          }
        }}
        onPointerMove={(e) => !dragging && setHover(hit(e))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const id = hit(e);
          if (!id) return ui({ selected: null });
          if (e.shiftKey || e.metaKey || e.ctrlKey) return toggleInSelection(id);
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
                    const snap = ev.altKey ? { value: Math.round(raw) } : snapColumn(tree(useStudio.getState().doc!)!, c.id, raw, rowWidth);
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
            linkable={inline.linkable}
            onDone={(v) => {
              const id = inline.id;
              setInline(null);
              if (v === null) return;
              edit((d) => {
                const h = tree(d) ? findBlock(tree(d), id) : null;
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
        {hover && hover !== selected && !multi.includes(hover) && rects[hover] && <div className="ov-hover" style={box(rects[hover])} />}
        {multi.length > 0 &&
          !dragging &&
          multi.map((id) => rects[id] && <div key={id} className="ov-select multi" style={box(rects[id])} data-testid="multi-frame" />)}
        {multi.length > 0 && !dragging && rects[multi[0]] && (
          <div
            className="ov-toolbar"
            style={{ left: rects[multi[0]].x, top: toolbarTop(rects[multi[0]], rects, multi[0]) }}
            role="toolbar"
            aria-label="Selection actions"
          >
            <span className="ov-name">{multi.length} blocks</span>
            <button onClick={duplicateSelected} title="Duplicate (⌘D)" aria-label="Duplicate">
              <Copy size={14} />
            </button>
            <button onClick={removeSelected} title="Delete (Del)" aria-label="Delete" data-testid="delete-block">
              <Trash2 size={14} />
            </button>
          </div>
        )}
        {sel && selRect && !dragging && !multi.length && (
          <>
            <div className="ov-select" style={box(selRect)} />
            <button
              className="ov-grip"
              style={{ left: selRect.x - 30, top: selRect.y + selRect.h / 2 - 14 }}
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
            {spec &&
              handlesFor(spec, selRect).map((dir) => {
                const cx = dir.includes("w") ? selRect.x : dir.includes("e") ? selRect.x + selRect.w : selRect.x + selRect.w / 2;
                const cy = dir.includes("n") ? selRect.y : dir.includes("s") ? selRect.y + selRect.h : selRect.y + selRect.h / 2;
                const corner = dir.length === 2;
                return (
                  <button
                    key={dir}
                    className={`ov-resize ${corner ? "corner" : dir === "n" || dir === "s" ? "edge-h" : "edge-v"}`}
                    style={{ left: cx, top: cy, cursor: HANDLE_CURSOR[dir] }}
                    title="Drag to resize · Alt for free sizing"
                    aria-label={`Resize from the ${DIR_NAME[dir]}`}
                    data-testid={dir === "se" ? "resize-handle" : `resize-handle-${dir}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const id = sel.block.id;
                      const x0 = e.clientX;
                      const y0 = e.clientY;
                      const box = { w: selRect.w / zoom, h: selRect.h / zoom };
                      document.body.classList.add("is-resizing");
                      document.body.style.cursor = HANDLE_CURSOR[dir];
                      const move = (ev: PointerEvent) => {
                        const raw = resizeValue(spec, dir, (ev.clientX - x0) / zoom, (ev.clientY - y0) / zoom, box);
                        // Hold Alt to resize freely without snapping.
                        const snap = ev.altKey ? { value: raw } : snapResize(useStudio.getState().doc!, id, raw, resizeKind(sel.block));
                        const v = snap.value;
                        edit((d) => {
                          const h = tree(d) ? findBlock(tree(d), id) : null;
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
                        document.body.style.cursor = "";
                        setTip(null);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                      window.addEventListener("pointercancel", up);
                    }}
                  />
                );
              })}
            <div className="ov-toolbar" style={{ left: selRect.x, top: toolbarTop(selRect, rects, selected!) }} role="toolbar" aria-label="Block actions">
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
          {resolution.indicator.height ? (
            <div
              className="dnd-line v"
              style={{ left: resolution.indicator.x - 1, top: resolution.indicator.y, height: resolution.indicator.height }}
              data-testid="drop-beside"
            />
          ) : (
            <div className="dnd-line" style={{ left: resolution.indicator.x, top: resolution.indicator.y - 1, width: resolution.indicator.width }} />
          )}
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
function InlineEditor({
  rect,
  value,
  multiline,
  linkable,
  onDone,
}: {
  rect: Rect;
  value: string;
  multiline: boolean;
  linkable?: boolean;
  onDone: (v: string | null) => void;
}) {
  const [v, setV] = useState(value);
  const done = useRef(false);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const linker = useLinker(ref, v, setV);
  const finish = (out: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(out);
  };
  const props = {
    className: "ov-inline",
    ref,
    value: v,
    autoFocus: true,
    "aria-label": "Edit text",
    "data-testid": "inline-editor",
    style: { left: rect.x - 4, top: rect.y - 4, width: Math.max(180, rect.w + 8), minHeight: rect.h + 8 },
    onFocus: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => e.currentTarget.select(),
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => {
      if (!linker.open) finish(v);
    },
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (linkable) linker.onKey(e);
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        finish(v);
      }
    },
  };
  const field = multiline ? <textarea {...props} rows={Math.max(2, v.split("\n").length)} /> : <input {...props} />;
  if (!linker.popover) return field;
  return (
    <>
      {field}
      <div className="ov-link-pop" style={{ left: rect.x - 4, top: rect.y + rect.h + 10 }}>
        {linker.popover}
      </div>
    </>
  );
}
