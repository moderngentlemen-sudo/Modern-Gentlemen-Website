"use client";

import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";

import { CartProvider } from "@/lib/cart/CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { products as DEMO_PRODUCTS } from "@/lib/demo/catalog";
import { registry } from "@/components/sections/registry";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";
import { findBlock } from "@/lib/blocks/traverse";
import { visualCss } from "@/lib/blocks/visual";
import type { BlockNode, BlockSlot } from "@/lib/blocks/types";
import { clsx } from "@/components/ui/clsx";
import { Button, IconButton } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";

import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { BlockDesignFrame } from "@/components/BlockDesignFrame";
import { VisualElementFrame } from "@/components/VisualElementFrame";
import { useBuilder } from "./StoreContext";
import { usePattern } from "./PatternsContext";
import { gapDropId, parseDragId, type DropLocation } from "./dnd";
import { subtreeContains } from "./tree";

/** Widths the device switcher previews at. */
const DEVICE_WIDTH = {
  desktop: "w-full",
  tablet: "w-[834px]",
  mobile: "w-[390px]",
} as const;

const ALIGNMENT_THRESHOLD_PX = 6;

interface ResizeAlignment {
  widthPercent: number;
  guideX: number;
}

interface CanvasGeometry {
  alignResize: (frame: HTMLElement, widthPercent: number) => ResizeAlignment | null;
  handActive: boolean;
  setGuideX: (guideX: number | null) => void;
}

const CanvasGeometryContext = createContext<CanvasGeometry | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button,a,[role='button']") !== null;
}

/**
 * The page preview, and the drop surface for the library rail.
 *
 * `DndContext` lives in `Builder.tsx`, not here — it has to wrap the rail as
 * well as the canvas for a cross-container drag to be possible at all, and it
 * has to be outside the empty-tree branch or a brand-new page (the first thing
 * an editor meets) would have no drag context whatsoever.
 *
 * `drop` is the insertion point under the pointer, which names a container as
 * well as an index now that lists nest. The legacy `libraryDragType` prop keeps
 * isolated canvas previews deterministic; during a real gesture the active
 * dnd-kit id supplies the drag kind, dragged type and source node so existing
 * block drags can use the same gaps as library drags.
 */
export function Canvas({
  libraryDragType = null,
  drop = null,
}: {
  libraryDragType?: string | null;
  drop?: DropLocation | null;
} = {}) {
  const tree = useBuilder(useShallow((s) => s.tree));
  const device = useBuilder((s) => s.device);
  const selectedKeys = useBuilder((s) => s.selectedKeys);
  const duplicateSelected = useBuilder((s) => s.duplicateSelected);
  const removeSelected = useBuilder((s) => s.removeSelected);
  const canvasZoom = useBuilder((s) => s.canvasZoom);
  const setCanvasZoom = useBuilder((s) => s.setCanvasZoom);
  const canvasTool = useBuilder((s) => s.canvasTool);
  const setCanvasTool = useBuilder((s) => s.setCanvasTool);
  const showRulers = useBuilder((s) => s.showRulers);
  const toggleRulers = useBuilder((s) => s.toggleRulers);
  const snapToGrid = useBuilder((s) => s.snapToGrid);
  const toggleSnapToGrid = useBuilder((s) => s.toggleSnapToGrid);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [spaceHand, setSpaceHand] = useState(false);
  const [panning, setPanning] = useState(false);
  const [guideX, setGuideX] = useState<number | null>(null);

  /**
   * `libraryDragType` is retained as a prop for the rail's rendering state and
   * for callers that render the canvas in isolation. The dnd context is the
   * authoritative source during a real gesture, however, because an existing
   * block drag deliberately has no library type.
   */
  const { active } = useDndContext();
  const activeDrag = active ? parseDragId(active.id) : null;
  const dragKind =
    activeDrag?.kind === "library" || activeDrag?.kind === "block"
      ? activeDrag.kind
      : libraryDragType !== null
        ? "library"
        : null;
  const dragType =
    activeDrag?.kind === "library"
      ? activeDrag.type
      : activeDrag?.kind === "block"
        ? (findBlock(tree, activeDrag.key)?._type ?? null)
        : libraryDragType;
  const draggedNode =
    activeDrag?.kind === "block" ? (findBlock(tree, activeDrag.key) ?? null) : null;
  const dragging = dragKind !== null;
  const handActive = canvasTool === "hand" || spaceHand;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        isInteractiveTarget(event.target)
      )
        return;
      event.preventDefault();
      setSpaceHand(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHand(false);
    };
    const blur = () => {
      setSpaceHand(false);
      setPanning(false);
      panRef.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  function alignResize(frame: HTMLElement, widthPercent: number): ResizeAlignment | null {
    const viewport = viewportRef.current;
    const sheet = viewport?.querySelector<HTMLElement>("[data-canvas-sheet]");
    if (!viewport || !sheet) return null;

    const frameRect = frame.getBoundingClientRect();
    const rawX = frameRect.left + (frameRect.width * widthPercent) / 100;
    const candidates = new Set<number>();
    const addRect = (rect: DOMRect) => {
      candidates.add(rect.left);
      candidates.add(rect.left + rect.width / 2);
      candidates.add(rect.right);
    };

    addRect(sheet.getBoundingClientRect());
    for (const peer of sheet.querySelectorAll<HTMLElement>("[data-block-key]")) {
      if (peer === frame || frame.contains(peer) || peer.contains(frame)) continue;
      const key = peer.dataset.blockKey;
      const visual = key ? findBlock(tree, key)?.visual : undefined;
      const scope = key && visual ? visualCss(key, visual).scope : null;
      const rendered = scope
        ? peer.querySelector<HTMLElement>(`[data-mg-visual="${scope}"]`)
        : null;
      addRect((rendered ?? peer).getBoundingClientRect());
    }

    let closest: number | null = null;
    let distance = ALIGNMENT_THRESHOLD_PX + 1;
    for (const candidate of candidates) {
      const nextDistance = Math.abs(candidate - rawX);
      if (nextDistance <= ALIGNMENT_THRESHOLD_PX && nextDistance < distance) {
        closest = candidate;
        distance = nextDistance;
      }
    }
    if (closest === null) return null;

    const viewportRect = viewport.getBoundingClientRect();
    return {
      widthPercent: Math.min(
        100,
        Math.max(5, Math.round(((closest - frameRect.left) / frameRect.width) * 1000) / 10)
      ),
      guideX: closest - viewportRect.left + viewport.scrollLeft,
    };
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !handActive ||
      event.button !== 0 ||
      isEditableTarget(event.target) ||
      isInteractiveTarget(event.target)
    )
      return;
    event.preventDefault();
    const viewport = event.currentTarget;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture?.(event.pointerId);
    setPanning(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  }

  function finishPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    panRef.current = null;
    setPanning(false);
  }

  return (
    /**
     * Both providers are REQUIRED, not defensive.
     * `components/sections/ProductRow.tsx` calls `useCart()` and `useCatalog()`,
     * and both throw when the context is missing — so without these wrappers,
     * dropping a product row onto the canvas takes down the whole builder.
     * Being free of *server* dependencies is not the same as being free of
     * context. CatalogProvider goes outside, because CartProvider reads it.
     *
     * The canvas is fed the demo catalogue rather than the published rows, for
     * the same reason `lib/blocks/sources/demo.ts` exists: this is a preview
     * surface that must render without a fetch. The two agree in practice —
     * `scripts/seed.ts` seeds the database from this very module.
     */
    <CatalogProvider products={DEMO_PRODUCTS}>
      <CartProvider>
        <div className="sticky top-0 z-50 flex items-center justify-end gap-2 border-b border-mg-bd/15 bg-mg-bg/95 px-6 py-2 backdrop-blur">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Canvas</span>
          <Button
            size="sm"
            variant={canvasTool === "select" ? "solid" : "outline"}
            onClick={() => setCanvasTool("select")}
            aria-label="Select tool"
          >
            Select
          </Button>
          <Button
            size="sm"
            variant={canvasTool === "hand" ? "solid" : "outline"}
            onClick={() => setCanvasTool("hand")}
            aria-label="Hand tool"
            title="Drag the canvas to pan, or hold Space"
          >
            Hand
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCanvasZoom(canvasZoom - 0.1)}
            aria-label="Zoom out"
          >
            <span aria-hidden="true">−</span>
            <span className="sr-only">Zoom out</span>
          </Button>
          <button
            type="button"
            onClick={() => setCanvasZoom(1)}
            className="w-12 font-mono text-[10px]"
            aria-label="Reset canvas zoom"
          >
            {Math.round(canvasZoom * 100)}%
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCanvasZoom(canvasZoom + 0.1)}
            aria-label="Zoom in"
          >
            <span aria-hidden="true">+</span>
            <span className="sr-only">Zoom in</span>
          </Button>
          <Button size="sm" variant={showRulers ? "solid" : "outline"} onClick={toggleRulers}>
            Rulers
          </Button>
          <Button size="sm" variant={snapToGrid ? "solid" : "outline"} onClick={toggleSnapToGrid}>
            Snap 5%
          </Button>
        </div>
        {selectedKeys.length > 1 && (
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-mg-bd/15 bg-mg-bg/95 px-6 py-2 backdrop-blur">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
              {selectedKeys.length} elements selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={duplicateSelected}
                title="Duplicate selection (Ctrl/Cmd+D)"
              >
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={removeSelected}
                title="Delete selection (Delete/Backspace)"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        <CanvasGeometryContext.Provider value={{ alignResize, handActive, setGuideX }}>
          <div
            ref={viewportRef}
            data-canvas-viewport
            className={clsx(
              "relative flex justify-center overflow-auto px-6 py-6",
              handActive && (panning ? "cursor-grabbing select-none" : "cursor-grab")
            )}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={finishPan}
            onPointerCancel={finishPan}
          >
            {showRulers && (
              <>
                <div
                  data-canvas-ruler="horizontal"
                  className="pointer-events-none absolute inset-x-6 top-0 h-4 opacity-40"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg,currentColor 0 1px,transparent 1px 20px)",
                  }}
                />
                <div
                  data-canvas-ruler="vertical"
                  className="pointer-events-none absolute bottom-6 left-0 top-6 w-4 opacity-40"
                  style={{
                    background:
                      "repeating-linear-gradient(180deg,currentColor 0 1px,transparent 1px 20px)",
                  }}
                />
              </>
            )}
            {guideX !== null && (
              <div
                data-alignment-guide="vertical"
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-0 z-[60] border-l border-mg-accent"
                style={{ left: guideX }}
              />
            )}
            <div
              data-canvas-sheet
              className={clsx("transition-[width,transform]", DEVICE_WIDTH[device])}
              style={{ transform: `scale(${canvasZoom})`, transformOrigin: "top center" }}
            >
              {tree.length === 0 ? (
                <EmptyDropZone dragging={dragging} over={isOver(drop, null, 0)} />
              ) : (
                <BlockList
                  nodes={tree}
                  parentKey={null}
                  dragKind={dragKind}
                  dragType={dragType}
                  draggedNode={draggedNode}
                  drop={drop}
                />
              )}
            </div>
          </div>
        </CanvasGeometryContext.Provider>
      </CartProvider>
    </CatalogProvider>
  );
}

/**
 * A synced pattern, as the canvas shows it.
 *
 * Editor chrome rather than a section, so it is styled from the admin's own
 * vocabulary — this never reaches the public site, where the node has been
 * substituted for the pattern's blocks long before rendering.
 *
 * The unresolved case is the one worth designing for: a pattern that was
 * deleted, or unpublished, or that this editor cannot read. The public path
 * renders a gap for it, deliberately, so the canvas is the only place anybody
 * finds out — which makes saying so plainly the whole job of the accent state.
 */
function PatternRefCard({
  name,
  blockCount,
  resolved,
  published,
  locked,
  onDetach,
}: {
  name: string | undefined;
  blockCount: number;
  resolved: boolean;
  published: boolean;
  locked: boolean;
  onDetach: () => void;
}) {
  /**
   * ⚠️ A resolved-but-unpublished pattern is the quiet failure this card exists
   * to make loud.
   *
   * `expandPublicPatterns` reads `published_data` and nothing else — it must,
   * or one editor's half-finished draft would appear on every page using the
   * pattern. So a synced pattern that has never been published composes here,
   * previews correctly (preview prefers the draft, by design) and then renders
   * a **gap** on the live page. Everything upstream looks right, which is
   * exactly why it has to be said here.
   */
  const warn = !resolved || !published;

  return (
    <div
      className={clsx(
        "border border-dashed px-6 py-8",
        warn ? "border-mg-accentSerif/50 bg-mg-accent/5" : "border-mg-bd/30 bg-mg-fg/[0.02]"
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/60">
        {!resolved
          ? "Synced pattern — unresolved"
          : published
            ? "Synced pattern"
            : "Synced pattern — not published"}
      </p>

      <p className="mt-2 font-grotesk text-[15px] font-semibold tracking-[-0.02em]">
        {name ?? "This pattern is no longer available"}
      </p>

      <p className="mt-1 text-[13px] text-mg-fg/60">
        {!resolved ? (
          <>
            It may have been deleted, or you may not have permission to read it. The live page
            renders nothing here until it comes back or this reference is removed.
          </>
        ) : published ? (
          <>
            {blockCount} {blockCount === 1 ? "block" : "blocks"}, substituted when the page renders.
            Editing the pattern updates every page using it.
          </>
        ) : (
          <>
            This pattern has never been published, and the live site renders only published patterns
            — so this will be a gap on the page until someone publishes it. Preview will show it
            regardless, because a preview deliberately shows drafts.
          </>
        )}
      </p>

      {resolved && !locked && (
        <div className="mt-4">
          {/*
            Detaching is a one-way door and needs no confirmation: it *adds*
            content to the page — the pattern's blocks, as an editable copy —
            and takes nothing away. Undo covers it like any other tree edit.
          */}
          <Button size="sm" variant="outline" onClick={onDetach}>
            Detach a copy
          </Button>
        </div>
      )}
    </div>
  );
}

/** True when the pointer is over the gap at `index` in `parentKey`'s list. */
function isOver(drop: DropLocation | null, parentKey: string | null, index: number): boolean {
  return drop !== null && drop.parentKey === parentKey && drop.index === index;
}

/**
 * One insertion point, rendered while a library item or an existing block is
 * in flight. Existing block drags use these gaps to choose an exact position
 * inside a non-empty container rather than relying on a block's centre.
 *
 * They are registered for both library and existing-block drags. The gaps are
 * intentionally thin, so `closestCenter` still resolves to a block when the
 * pointer is over its body and to the explicit gap when the editor chooses a
 * position between blocks.
 */
function GapDropZone({
  index,
  parentKey,
  over,
}: {
  index: number;
  parentKey: string | null;
  over: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: gapDropId(index, parentKey) });

  return (
    <div
      ref={setNodeRef}
      data-gap-index={index}
      data-gap-parent={parentKey ?? undefined}
      className="relative h-6"
    >
      <div
        className={clsx(
          "absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 transition-colors",
          over ? "bg-mg-accent" : "bg-transparent"
        )}
      />
    </div>
  );
}

/**
 * A list of blocks and the insertion points around it — the root list, or a
 * container's children. One component for both, so nesting cannot drift into a
 * second rendering rule.
 */
function BlockList({
  nodes,
  parentKey,
  dragKind,
  dragType,
  draggedNode,
  drop,
  slot,
  depth = 0,
}: {
  nodes: BlockNode[];
  parentKey: string | null;
  dragKind: "library" | "block" | null;
  dragType: string | null;
  draggedNode: BlockNode | null;
  drop: DropLocation | null;
  /** The slot these nodes live in, or undefined for the root list. */
  slot?: BlockSlot;
  depth?: number;
}) {
  /**
   * ⚠️ **A list refuses insertion points for a type its slot would not accept,
   * and on a `columns` row that is what stops the grid falling apart.**
   *
   * The gaps are rendered as siblings of the children, so inside a container
   * they are children of whatever that container renders — and `Columns` renders
   * a CSS grid. Every gap therefore used to take a **grid cell**: a two-column
   * row holding two blocks laid out as five cells mid-drag, the blocks jumping
   * into the right-hand column on separate rows and snapping back on drop.
   *
   * A row's slot accepts `column` and nothing else, so during an ordinary
   * section drag it now offers no gaps at all — the grid stays exactly as it
   * renders. The section goes into a *column*, which is a list of its own and
   * lays its gaps out vertically like every other list. The same rule applies
   * to existing block drags, which is what makes precise in-container moves
   * possible without exposing invalid row positions.
   */
  const accepts = dragType === null || !slot?.allow || slot.allow.includes(dragType);

  /** A block may never receive its own branch, even while its descendants are empty. */
  const insideDraggedBranch =
    parentKey !== null && draggedNode !== null && subtreeContains(draggedNode, parentKey);

  /**
   * A horizontal slot never shows strips, and this is now **declared** rather
   * than falling out of `allow`.
   *
   * A row refuses a section already, so during an ordinary section drag the
   * `accepts` check above was doing the work. It would stop doing it the moment
   * something the row *does* accept were dragged — a column — and the grid would
   * take five cells again. Saying "these children sit side by side, do not put
   * anything between them" is the honest rule; reordering inside such a slot
   * goes block-onto-block, which `dropTargetFor` makes land where it looks.
   */
  const dragging =
    dragKind !== null && accepts && !insideDraggedBranch && slot?.direction !== "horizontal";

  return (
    <SortableContext items={nodes.map((node) => node._key)} strategy={verticalListSortingStrategy}>
      {nodes.map((node, index) => (
        <Fragment key={node._key}>
          {dragging && (
            <GapDropZone
              index={index}
              parentKey={parentKey}
              over={isOver(drop, parentKey, index)}
            />
          )}
          <SortableBlock
            node={node}
            dragKind={dragKind}
            dragType={dragType}
            draggedNode={draggedNode}
            drop={drop}
            depth={depth}
          />
        </Fragment>
      ))}
      {dragging && (
        <GapDropZone
          index={nodes.length}
          parentKey={parentKey}
          over={isOver(drop, parentKey, nodes.length)}
        />
      )}
    </SortableContext>
  );
}

/**
 * A container with nothing in it.
 *
 * Registered as a droppable **whatever is being dragged**. It is the empty-list
 * form of the same gap vocabulary, and remains available when a block is moved
 * into a container that has no siblings to position around.
 */
function EmptySlot({
  parentKey,
  label,
  over,
  disabled = false,
}: {
  parentKey: string;
  label: string;
  over: boolean;
  disabled?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: gapDropId(0, parentKey), disabled });

  return (
    <div
      ref={setNodeRef}
      data-gap-index={disabled ? undefined : 0}
      data-gap-parent={parentKey}
      className={clsx(
        "flex min-h-[120px] items-center justify-center border border-dashed p-6 text-center",
        over && !disabled ? "border-mg-accent bg-mg-accent/5" : "border-mg-fg/20"
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mg-fg/60">
        {label} — drop a section here
      </p>
    </div>
  );
}

/** The empty page — itself the drop target, resolving to index 0. */
function EmptyDropZone({ dragging, over }: { dragging: boolean; over: boolean }) {
  const { setNodeRef } = useDroppable({ id: gapDropId(0), disabled: !dragging });

  return (
    <div
      ref={setNodeRef}
      data-gap-index={dragging ? 0 : undefined}
      className={clsx("transition-shadow", over && "ring-2 ring-mg-accent")}
    >
      <EmptyState eyebrow="Empty page" title="Add your first section">
        Pick a section from the library on the left, or drag one onto the page. Everything you add
        renders here exactly as it will on the live site.
      </EmptyState>
    </div>
  );
}

function SortableBlock({
  node,
  dragKind,
  dragType,
  draggedNode,
  drop,
  depth,
}: {
  node: BlockNode;
  dragKind: "library" | "block" | null;
  dragType: string | null;
  draggedNode: BlockNode | null;
  drop: DropLocation | null;
  depth: number;
}) {
  const selectedKeys = useBuilder((s) => s.selectedKeys);
  const select = useBuilder((s) => s.select);
  const duplicate = useBuilder((s) => s.duplicate);
  const remove = useBuilder((s) => s.remove);
  const setLocked = useBuilder((s) => s.setLocked);
  const setVisibility = useBuilder((s) => s.setVisibility);
  const setVisualStyle = useBuilder((s) => s.setVisualStyle);
  const snapToGrid = useBuilder((s) => s.snapToGrid);
  const device = useBuilder((s) => s.device);
  const geometry = useContext(CanvasGeometryContext);
  const issueCount = useBuilder(
    (s) =>
      s.issues.filter((i) => i.key === node._key).length +
      s.serverIssues.filter((i) => i.key === node._key).length
  );

  const locked = node.locked === true;
  const hidden = node.visibility?.hidden === true;
  const hiddenOnDevice =
    node.visibility?.devices !== undefined && !node.visibility.devices.includes(device);
  const selected = selectedKeys.includes(node._key);
  const visualWidth = node.visual?.styles?.[device]?.widthPercent ?? 100;

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const frame = event.currentTarget.closest<HTMLElement>("[data-block-key]");
    if (!frame) return;
    const startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const startWidth = visualWidth;
    const available = Math.max(frame.getBoundingClientRect().width, 1);

    const move = (next: PointerEvent) => {
      if (!Number.isFinite(next.clientX)) return;
      const raw = Math.min(
        100,
        Math.max(5, startWidth + ((next.clientX - startX) / available) * 100)
      );
      const aligned = geometry?.alignResize(frame, raw) ?? null;
      geometry?.setGuideX(aligned?.guideX ?? null);
      const widthPercent =
        aligned?.widthPercent ?? (snapToGrid ? Math.round(raw / 5) * 5 : Math.round(raw));
      setVisualStyle(node._key, device, {
        widthPercent,
        width: undefined,
        widthPx: undefined,
      });
    };
    const finish = () => {
      geometry?.setGuideX(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node._key,
    disabled: locked,
  });

  const manifest = manifestFor(node._type);
  const Component = registry[node._type as keyof typeof registry] as
    ComponentType<Record<string, unknown>> | undefined;

  /**
   * A synced pattern is a pointer, so the canvas shows the pointer.
   *
   * `PatternRef` renders nothing — correct on the public path, where the node
   * has already been substituted for the pattern's blocks, and useless here. The
   * card is what an editor sees instead.
   *
   * ⚠️ **It deliberately shows the reference rather than the pattern's content.**
   * Rendering the referenced blocks inline would look like the live page and
   * behave like nothing else on the canvas: they are not this document's blocks,
   * so they could not be selected, edited, reordered or deleted, and every one
   * of those would fail silently under the cursor. Preview is where the result
   * is shown — it expands refs already — and that division is the honest one:
   * the canvas edits this page, preview shows what publishing produces.
   */
  const isRef = typeof node._ref === "string" && node._ref.length > 0;
  const pattern = usePattern(node._ref);
  const detachPatternRef = useBuilder((s) => s.detachPatternRef);

  const label = isRef ? (pattern?.name ?? "Synced pattern") : (manifest?.label ?? node._type);

  /** Only a block whose manifest declares a slot may hold children. */
  const slot = manifest?.slot;
  const children = node.children ?? [];

  return (
    <div
      ref={setNodeRef}
      data-block-key={node._key}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("group relative", isDragging && "opacity-60")}
      /*
        ⚠️ `stopPropagation` is what makes the INNERMOST block win.

        Every frame carries this handler, so without it a mousedown on a nested
        block bubbles to its container's frame, whose handler runs afterwards
        and overwrites the selection — leaving the panel showing the container
        every time an editor clicks something inside one. Nothing throws; the
        panel simply shows the wrong block's fields.
      */
      onMouseDown={(event) => {
        event.stopPropagation();
        if (geometry?.handActive) return;
        select(node._key, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
    >
      {/*
        The section renders untouched. Every piece of editor chrome below is an
        absolutely positioned SIBLING, and the only class applied to the section
        is on this wrapper — never on the component's own root. That is what
        keeps "do not restyle the design components" true in the literal sense
        the pixel verification depends on.

        The descendant selectors kill navigation inside the canvas without
        adding anything to a section's markup.
      */}
      <div
        className={clsx(
          /*
            ⚠️ The navigation killer is applied to LEAVES ONLY, and that is not
            a shortcut.

            It compiles to `.wrapper button { pointer-events: none }`, which is
            a descendant selector — so on a container it would reach every
            nested block's own toolbar and make the drag handle, lock, duplicate
            and delete buttons of everything inside it silently unclickable. A
            `pointer-events-auto` utility on those buttons cannot win: the
            arbitrary variant's specificity is higher.

            A container's own markup carries no links or buttons (`Columns` is a
            section and a grid), and each nested leaf still applies the killer to
            its own content, so nothing about the guarantee is lost.

            ⚠️ **And a synced reference is exempt, for the opposite reason.**
            `patternRef` has no slot, so it is a leaf and the killer would apply
            — but what it wraps is not a design component at all. It is
            `PatternRefCard`, editor chrome, whose only button is "Detach a
            copy". Killing that leaves a control the editor can see, hover and
            focus and *cannot click*: no error, no disabled state, just a button
            that does nothing. The rule the killer enforces is "a section's own
            links must not navigate inside the canvas"; a card that renders no
            section has no such links to kill.
          */
          !slot && !isRef && "[&_a]:pointer-events-none [&_button]:pointer-events-none",
          (hidden || hiddenOnDevice) && "opacity-40"
        )}
        data-preview-hidden={hidden || hiddenOnDevice || undefined}
      >
        <BlockDesignFrame design={node.design}>
          <VisualElementFrame blockKey={node._key} visual={node.visual}>
            {isRef ? (
              <PatternRefCard
                name={pattern?.name}
                blockCount={pattern?.blockCount ?? 0}
                resolved={pattern !== undefined}
                published={pattern?.published ?? false}
                locked={locked}
                onDetach={() => pattern && detachPatternRef(node._key, pattern.blocks)}
              />
            ) : Component ? (
              <BlockErrorBoundary type={node._type} onSelect={() => select(node._key)}>
                {slot ? (
                  <Component {...normalizeBlock(node)}>
                    {children.length === 0 ? (
                      <EmptySlot
                        parentKey={node._key}
                        label={slot.label}
                        over={isOver(drop, node._key, 0)}
                        disabled={draggedNode !== null && subtreeContains(draggedNode, node._key)}
                      />
                    ) : (
                      <BlockList
                        nodes={children}
                        parentKey={node._key}
                        dragKind={dragKind}
                        dragType={dragType}
                        draggedNode={draggedNode}
                        drop={drop}
                        slot={slot}
                        depth={depth + 1}
                      />
                    )}
                  </Component>
                ) : (
                  <Component {...normalizeBlock(node)} />
                )}
              </BlockErrorBoundary>
            ) : (
              <div className="border border-mg-accentSerif/40 bg-mg-accent/5 px-6 py-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mg-accentSerif">
                  Unknown block: {node._type}
                </p>
              </div>
            )}
          </VisualElementFrame>
        </BlockDesignFrame>
      </div>

      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 ring-1 ring-inset transition-colors",
          selected ? "ring-mg-accent" : "ring-transparent group-hover:ring-mg-accent/30"
        )}
      />

      {selected && selectedKeys.length === 1 && !locked && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0 z-20 border-r border-dashed border-mg-accent/60"
            style={{ right: `${100 - visualWidth}%` }}
          />
          <button
            type="button"
            aria-label={`Resize ${label}`}
            onPointerDown={startResize}
            className="absolute top-1/2 z-30 h-12 w-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-full border border-mg-accent bg-mg-bg shadow-sm"
            style={{ right: `${100 - visualWidth}%` }}
          />
        </>
      )}

      {/*
        ⚠️ Deeper chrome sits above and below shallower chrome, and this is not
        polish.

        Every frame owns a top-right toolbar, and a first child can begin at the
        exact same corner as its container. Tailwind's `group-hover` fires for
        every ancestor group, so both controls are on screen at once. A flat
        `z-10` lets the container swallow child clicks; z-index by depth fixes
        that direction but creates the inverse defect — the child then covers
        the container's drag handle. CI exposed it because a drag aimed at a
        Column activated the Newsletter at index zero instead.

        Depth therefore owns a small vertical canvas lane as well as a z-index.
        This affects editor chrome only: it does not wrap or offset the section,
        and it leaves both the parent and child controls independently hittable.

        ⚠️ **The bar itself takes no pointer events; only its buttons do.** Once
        columns put two blocks SIDE BY SIDE, one frame's chrome could sit over a
        neighbour's — an absolutely positioned overlay is not bounded by the
        column it belongs to. CI found it the first run after columns became
        containers: the Newsletter's label chip in the second column swallowed
        every click on the Timeline's Duplicate button in the first, with
        Playwright reporting "subtree intercepts pointer events" and the test
        timing out on a button it could see perfectly well.

        The label and the issue badge are decorative — they should never have
        been able to eat a click — so the bar is `pointer-events-none` and each
        control opts back in. This is not the leaf-only navigation killer on the
        content wrapper below; that is a different element, and these buttons
        are its siblings rather than its descendants.
      */}
      <div
        style={{ zIndex: 10 + depth, top: 8 + depth * 40 }}
        className="pointer-events-none absolute right-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
      >
        <span className="mr-1 bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white">
          {label}
        </span>
        {issueCount > 0 && <Badge tone="danger">{issueCount}</Badge>}

        <IconButton
          label={`Drag ${label}`}
          disabled={locked}
          className="pointer-events-auto cursor-grab bg-mg-surface"
          {...attributes}
          {...listeners}
        >
          ⠿
        </IconButton>
        <IconButton
          label={hidden ? `Show ${label}` : `Hide ${label}`}
          className="pointer-events-auto bg-mg-surface"
          onClick={() => setVisibility(node._key, { hidden: !hidden })}
        >
          {hidden ? "◌" : "◉"}
        </IconButton>
        <IconButton
          label={locked ? `Unlock ${label}` : `Lock ${label}`}
          active={locked}
          className="pointer-events-auto bg-mg-surface"
          onClick={() => setLocked(node._key, !locked)}
        >
          {locked ? "🔒" : "🔓"}
        </IconButton>
        <IconButton
          label={`Duplicate ${label}`}
          disabled={locked}
          className="pointer-events-auto bg-mg-surface"
          onClick={() => duplicate(node._key)}
        >
          ⧉
        </IconButton>
        <IconButton
          label={`Delete ${label}`}
          disabled={locked}
          className="pointer-events-auto bg-mg-surface"
          onClick={() => remove(node._key)}
        >
          ✕
        </IconButton>
      </div>
    </div>
  );
}
