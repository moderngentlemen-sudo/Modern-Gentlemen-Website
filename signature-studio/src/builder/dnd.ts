/**
 * Pointer-based drag and drop (mouse, pen and touch — works on iPad).
 * Surfaces register resolvers that turn a pointer position into a drop
 * target plus an indicator; the first resolver that claims the point wins.
 */
import { create } from "zustand";
import type { Block } from "../core/types";
import { addBlock, moveTo, type DropTarget } from "./actions";

export type DragSource = { kind: "new"; create: () => Block } | { kind: "move"; id: string };

export interface Indicator {
  /** Viewport px. */
  x: number;
  y: number;
  width: number;
  /** Set for a vertical line (dropping beside a block). */
  height?: number;
  /** Outline of the receiving column. */
  box: { x: number; y: number; w: number; h: number };
}

export interface Resolution {
  target: DropTarget;
  indicator: Indicator;
}

export type Resolver = (x: number, y: number, source: DragSource) => Resolution | null;

interface DragState {
  source: DragSource | null;
  label: string;
  x: number;
  y: number;
  resolution: Resolution | null;
}

export const useDrag = create<DragState>(() => ({ source: null, label: "", x: 0, y: 0, resolution: null }));

const resolvers = new Set<Resolver>();

export function registerResolver(r: Resolver) {
  resolvers.add(r);
  return () => void resolvers.delete(r);
}

function resolve(x: number, y: number, source: DragSource): Resolution | null {
  for (const r of resolvers) {
    const res = r(x, y, source);
    if (res) return res;
  }
  return null;
}

const THRESHOLD = 5;

/**
 * Track a potential drag from a pointerdown. The drag starts only after the
 * pointer moves a few pixels, so a plain click/tap still works.
 */
export function armDrag(e: { clientX: number; clientY: number; pointerId: number }, source: DragSource, label: string, onClick?: () => void) {
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    document.body.classList.remove("is-dragging");
    useDrag.setState({ source: null, resolution: null });
  };
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      started = true;
      document.body.classList.add("is-dragging");
      window.getSelection()?.removeAllRanges();
      useDrag.setState({ source, label });
    }
    ev.preventDefault();
    useDrag.setState({ x: ev.clientX, y: ev.clientY, resolution: resolve(ev.clientX, ev.clientY, source) });
  };
  const up = (ev: PointerEvent) => {
    const wasDrag = started;
    const res = wasDrag ? resolve(ev.clientX, ev.clientY, source) : null;
    finish();
    if (!wasDrag) return onClick?.();
    if (!res) return;
    if (source.kind === "new") addBlock(source.create(), res.target);
    else moveTo(source.id, res.target);
  };
  const cancel = () => finish();
  const key = (ev: KeyboardEvent) => ev.key === "Escape" && finish();
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
}
