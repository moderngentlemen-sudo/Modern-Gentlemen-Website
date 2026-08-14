"use client";

import { Fragment, type ComponentType } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";

import { CartProvider } from "@/lib/cart/CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { products as DEMO_PRODUCTS } from "@/lib/demo/catalog";
import { registry } from "@/components/sections/registry";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";
import type { BlockNode } from "@/lib/blocks/types";
import { clsx } from "@/components/ui/clsx";
import { IconButton } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";

import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { useBuilder } from "./StoreContext";
import { gapDropId } from "./dnd";

/** Widths the device switcher previews at. */
const DEVICE_WIDTH = {
  desktop: "w-full",
  tablet: "w-[834px]",
  mobile: "w-[390px]",
} as const;

/**
 * The page preview, and the drop surface for the library rail.
 *
 * `DndContext` lives in `Builder.tsx`, not here — it has to wrap the rail as
 * well as the canvas for a cross-container drag to be possible at all, and it
 * has to be outside the empty-tree branch or a brand-new page (the first thing
 * an editor meets) would have no drag context whatsoever.
 *
 * The two props are that context's state, passed down rather than read from
 * `useDndContext` so the rendering rule stays a function of its inputs and can
 * be asserted without a layout engine. `libraryDragType` is the type being
 * dragged in, or `null`; `dropIndex` is the insertion point under the pointer.
 */
export function Canvas({
  libraryDragType = null,
  dropIndex = null,
}: {
  libraryDragType?: string | null;
  dropIndex?: number | null;
} = {}) {
  const tree = useBuilder(useShallow((s) => s.tree));
  const device = useBuilder((s) => s.device);

  const dragging = libraryDragType !== null;

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
        <div className="flex justify-center px-6 py-6">
          <div className={clsx("transition-[width]", DEVICE_WIDTH[device])}>
            {tree.length === 0 ? (
              <EmptyDropZone dragging={dragging} over={dropIndex === 0} />
            ) : (
              <SortableContext
                items={tree.map((node) => node._key)}
                strategy={verticalListSortingStrategy}
              >
                {tree.map((node, index) => (
                  <Fragment key={node._key}>
                    {dragging && <GapDropZone index={index} over={dropIndex === index} />}
                    <SortableBlock node={node} />
                  </Fragment>
                ))}
                {dragging && <GapDropZone index={tree.length} over={dropIndex === tree.length} />}
              </SortableContext>
            )}
          </div>
        </div>
      </CartProvider>
    </CatalogProvider>
  );
}

/**
 * One insertion point, rendered only while a library item is in flight.
 *
 * Registering them conditionally is what keeps block reordering unaffected: a
 * gap is never a candidate `over` target for a drag that started on the canvas,
 * so `closestCenter` still resolves to a block exactly as it did before.
 */
function GapDropZone({ index, over }: { index: number; over: boolean }) {
  const { setNodeRef } = useDroppable({ id: gapDropId(index) });

  return (
    <div ref={setNodeRef} data-gap-index={index} className="relative h-6">
      <div
        className={clsx(
          "absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 transition-colors",
          over ? "bg-mg-accent" : "bg-transparent"
        )}
      />
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

function SortableBlock({ node }: { node: BlockNode }) {
  const selectedKey = useBuilder((s) => s.selectedKey);
  const select = useBuilder((s) => s.select);
  const duplicate = useBuilder((s) => s.duplicate);
  const remove = useBuilder((s) => s.remove);
  const setLocked = useBuilder((s) => s.setLocked);
  const setVisibility = useBuilder((s) => s.setVisibility);
  const issueCount = useBuilder(
    (s) =>
      s.issues.filter((i) => i.key === node._key).length +
      s.serverIssues.filter((i) => i.key === node._key).length
  );

  const locked = node.locked === true;
  const hidden = node.visibility?.hidden === true;
  const selected = selectedKey === node._key;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node._key,
    disabled: locked,
  });

  const Component = registry[node._type as keyof typeof registry] as
    ComponentType<Record<string, unknown>> | undefined;
  const label = manifestFor(node._type)?.label ?? node._type;

  return (
    <div
      ref={setNodeRef}
      data-block-key={node._key}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("group relative", isDragging && "opacity-60")}
      onMouseDown={() => select(node._key)}
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
          "[&_a]:pointer-events-none [&_button]:pointer-events-none",
          hidden && "opacity-40"
        )}
      >
        {Component ? (
          <BlockErrorBoundary type={node._type} onSelect={() => select(node._key)}>
            <Component {...normalizeBlock(node)} />
          </BlockErrorBoundary>
        ) : (
          <div className="border border-mg-accentSerif/40 bg-mg-accent/5 px-6 py-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mg-accentSerif">
              Unknown block: {node._type}
            </p>
          </div>
        )}
      </div>

      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 ring-1 ring-inset transition-colors",
          selected ? "ring-mg-accent" : "ring-transparent group-hover:ring-mg-accent/30"
        )}
      />

      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <span className="mr-1 bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white">
          {label}
        </span>
        {issueCount > 0 && <Badge tone="danger">{issueCount}</Badge>}

        <IconButton
          label={`Drag ${label}`}
          disabled={locked}
          className="cursor-grab bg-mg-surface"
          {...attributes}
          {...listeners}
        >
          ⠿
        </IconButton>
        <IconButton
          label={hidden ? `Show ${label}` : `Hide ${label}`}
          className="bg-mg-surface"
          onClick={() => setVisibility(node._key, { hidden: !hidden })}
        >
          {hidden ? "◌" : "◉"}
        </IconButton>
        <IconButton
          label={locked ? `Unlock ${label}` : `Lock ${label}`}
          active={locked}
          className="bg-mg-surface"
          onClick={() => setLocked(node._key, !locked)}
        >
          {locked ? "🔒" : "🔓"}
        </IconButton>
        <IconButton
          label={`Duplicate ${label}`}
          disabled={locked}
          className="bg-mg-surface"
          onClick={() => duplicate(node._key)}
        >
          ⧉
        </IconButton>
        <IconButton
          label={`Delete ${label}`}
          disabled={locked}
          className="bg-mg-surface"
          onClick={() => remove(node._key)}
        >
          ✕
        </IconButton>
      </div>
    </div>
  );
}
