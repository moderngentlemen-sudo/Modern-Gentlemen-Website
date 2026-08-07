"use client";

import { type ComponentType } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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

/** Widths the device switcher previews at. */
const DEVICE_WIDTH = {
  desktop: "w-full",
  tablet: "w-[834px]",
  mobile: "w-[390px]",
} as const;

export function Canvas() {
  const tree = useBuilder(useShallow((s) => s.tree));
  const device = useBuilder((s) => s.device);
  const move = useBuilder((s) => s.move);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    move(String(active.id), String(over.id));
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
        <div className="flex justify-center px-6 py-6">
          <div className={clsx("transition-[width]", DEVICE_WIDTH[device])}>
            {tree.length === 0 ? (
              <EmptyState eyebrow="Empty page" title="Add your first section">
                Pick a section from the library on the left. Everything you add renders here exactly
                as it will on the live site.
              </EmptyState>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={tree.map((node) => node._key)}
                  strategy={verticalListSortingStrategy}
                >
                  {tree.map((node) => (
                    <SortableBlock key={node._key} node={node} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </CartProvider>
    </CatalogProvider>
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
