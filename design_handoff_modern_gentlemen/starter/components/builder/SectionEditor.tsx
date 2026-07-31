"use client";

/**
 * Level-B in-app drag-and-drop page builder (see 05_SECTION_BUILDER.md).
 * Reuses the SAME section components + registry as the live site — the editor
 * just wraps each block in a sortable frame. Level A (the Sanity array editor)
 * gives drag-and-drop for free; build this only if you want an on-page canvas.
 *
 * Persist `sections` back to Sanity via a mutation on save.
 */
import { useState, type ComponentType } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { registry, blockCatalog, type BlockType } from "../sections/registry";

interface Block {
  _key: string;
  _type: BlockType;
  [k: string]: unknown;
}

let uid = 0;
const key = () => `blk_${Date.now()}_${uid++}`;

export function SectionEditor({
  initial = [] as Block[],
  onSave,
}: {
  initial?: Block[];
  onSave?: (b: Block[]) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b._key === active.id);
    const newIndex = blocks.findIndex((b) => b._key === over.id);
    setBlocks((b) => arrayMove(b, oldIndex, newIndex));
  }

  const addBlock = (type: BlockType) =>
    setBlocks((b) => [...b, { _key: key(), _type: type } as Block]);
  const removeBlock = (k: string) => setBlocks((b) => b.filter((x) => x._key !== k));

  return (
    <div className="grid grid-cols-[240px_1fr] gap-6 min-h-screen">
      {/* Library rail */}
      <aside className="border-r border-mg-bd/15 p-4 sticky top-0 h-screen overflow-auto">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-4">
          Add section
        </h3>
        <div className="grid gap-2">
          {blockCatalog.map((b) => (
            <button
              key={b.type}
              onClick={() => addBlock(b.type)}
              className="text-left border border-mg-bd/20 px-3 py-2 text-sm hover:border-mg-accent hover:text-mg-accent"
            >
              {b.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSave?.(blocks)}
          className="mt-6 w-full bg-mg-accent text-white py-2 font-mono text-xs uppercase tracking-[0.15em]"
        >
          Save page
        </button>
      </aside>

      {/* Sortable canvas */}
      <div className="py-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b._key)} strategy={verticalListSortingStrategy}>
            {blocks.map((b) => (
              <SortableBlock key={b._key} block={b} onRemove={() => removeBlock(b._key)} />
            ))}
          </SortableContext>
        </DndContext>
        {blocks.length === 0 && (
          <p className="text-mg-fg/40 font-mono text-sm p-10 text-center">
            Add sections from the left to build the page.
          </p>
        )}
      </div>
    </div>
  );
}

function SortableBlock({ block, onRemove }: { block: Block; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._key,
  });
  // The registry is heterogeneous by design — each block owns its own prop
  // contract — so the lookup is widened to a generic prop bag here. Phase 2's
  // `defineBlock()` manifests restore per-block type safety via Zod schemas.
  const Cmp = registry[block._type] as ComponentType<Record<string, unknown>> | undefined;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="relative group mb-4 outline outline-1 outline-transparent hover:outline-mg-accent/40"
    >
      {/* Frame toolbar */}
      <div className="absolute z-10 top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab bg-black/70 text-white text-xs px-2 py-1 font-mono"
        >
          drag
        </button>
        <button onClick={onRemove} className="bg-black/70 text-white text-xs px-2 py-1 font-mono">
          delete
        </button>
      </div>
      {Cmp ? (
        <Cmp {...block} />
      ) : (
        <div className="p-6 font-mono text-sm text-mg-accent">Unknown: {block._type}</div>
      )}
    </div>
  );
}
