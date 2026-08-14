"use client";

import { useMemo, useState, type PointerEventHandler } from "react";
import { useDndContext, useDraggable } from "@dnd-kit/core";

import { clsx } from "@/components/ui/clsx";
import { blockCatalog } from "@/components/sections/registry";
import { BLOCK_CATEGORIES } from "@/lib/blocks/types";
import { TextInput } from "@/components/admin/ui/Input";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";

import { libraryDragId } from "./dnd";
import { BlockPreview, PREVIEW_HEIGHT } from "./BlockPreview";

/**
 * The section picker.
 *
 * Fed straight from `blockCatalog`, which `components/sections/registry.ts`
 * already derives from the manifests — so a block's label and description have
 * exactly one home, and a new block appears here the moment its manifest exists.
 *
 * Groups iterate `BLOCK_CATEGORIES` rather than the categories present in the
 * catalogue, so the order is the declared one (hero, editorial, commerce, bands,
 * people) instead of whatever order blocks happen to be registered in.
 *
 * Entries are draggable *and* clickable. The rail only sits inside a drag
 * context because `DndContext` was hoisted to `Builder.tsx` — while it lived in
 * `Canvas.tsx`, dragging from here onto the canvas was structurally impossible
 * rather than merely unimplemented.
 *
 * Hovering or focusing an entry previews the real section beside the rail. One
 * is rendered at a time, on demand: mounting twenty-three live sections into a
 * 230px column would make opening the library the slowest thing in the builder.
 */
export function InsertMenu({ onInsert }: { onInsert: (type: string) => void }) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ type: string; top: number; left: number } | null>(null);

  /**
   * A drag hides the preview and keeps it hidden.
   *
   * Without this it fights the drag overlay for the same screen: the pointer
   * leaves the entry, which should dismiss it, but the entry it left is also
   * the thing now attached to the cursor.
   */
  const { active } = useDndContext();
  const showing = active ? null : preview;

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? blockCatalog.filter(
          (block) =>
            block.label.toLowerCase().includes(term) ||
            block.description.toLowerCase().includes(term)
        )
      : blockCatalog;

    return BLOCK_CATEGORIES.map((category) => ({
      category,
      blocks: matches.filter((block) => block.category === category),
    })).filter((group) => group.blocks.length > 0);
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <div className={clsx("border-b px-3 py-3", HAIRLINE)}>
        <TextInput label="Add a section" value={query} onChange={setQuery} placeholder="Search…" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-mg-fg/40">
            No section matches “{query}”.
          </p>
        )}

        {grouped.map((group) => (
          <section key={group.category} className={clsx("border-b", HAIRLINE)}>
            <h3 className={clsx(LABEL_SM, "px-3 pb-1 pt-3")}>{group.category}</h3>
            <ul>
              {group.blocks.map((block) => (
                <li key={block.type}>
                  <LibraryItem block={block} onInsert={onInsert} onPreview={setPreview} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showing && (
        /*
          ⚠️ `pointer-events-none` belongs on the WRAPPER, not only on the
          preview inside it.

          Click-to-insert leaves the pointer resting on the entry, so the
          preview stays open by design — and it is positioned over the canvas.
          With an interactive wrapper it swallows every click on the section
          underneath: CI failed a media spec that clicks a block right after
          inserting one, which is the exact sequence an editor performs.
        */
        <div
          className="pointer-events-none fixed z-50"
          style={{ top: showing.top, left: showing.left }}
        >
          <BlockPreview type={showing.type} />
        </div>
      )}
    </div>
  );
}

/**
 * One catalogue entry: a button that inserts on click, and a drag source.
 *
 * **Only the pointer activator is wired.** `listeners` also carries the
 * `KeyboardSensor`'s `onKeyDown`, which claims Enter and Space and calls
 * `preventDefault` — so spreading it would turn the keyboard's click-to-insert
 * into a keyboard drag and take away the accessible path this rail has always
 * had. dnd-kit's `attributes` are skipped for the same reason: announcing the
 * entry as draggable to a screen reader would be a promise nothing here keeps.
 *
 * Click and drag coexist on one control **because of the 6px activation
 * constraint `Builder.tsx` configures**, and that coupling is easy to break
 * from a distance. A stationary press never activates a drag, so the click
 * lands; once a drag *has* activated, dnd-kit adds a capture-phase `click`
 * listener on the document that stops propagation before React's root sees it,
 * so a completed drop inserts exactly one block rather than two. Remove the
 * constraint and every click here becomes a one-pixel drag instead.
 */
function LibraryItem({
  block,
  onInsert,
  onPreview,
}: {
  block: (typeof blockCatalog)[number];
  onInsert: (type: string) => void;
  onPreview: (preview: { type: string; top: number; left: number } | null) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: libraryDragId(block.type) });

  // dnd-kit types its activator map as `Record<string, Function>`, so picking a
  // single listener out of it needs the handler's real shape naming here.
  const onPointerDown = listeners?.onPointerDown as
    PointerEventHandler<HTMLButtonElement> | undefined;

  /**
   * Anchored off the entry's own rect rather than a hardcoded rail width, and
   * clamped so an entry near the bottom does not preview off-screen.
   */
  function show(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    onPreview({
      type: block.type,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - PREVIEW_HEIGHT - 8)),
      left: rect.right + 8,
    });
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onInsert(block.type)}
      onPointerDown={onPointerDown}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => onPreview(null)}
      // Focus as well as hover: the keyboard is the accessible path through
      // this rail, and a preview only a mouse can reach would be a feature
      // added for one half of the users.
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => onPreview(null)}
      className={clsx(
        "block w-full cursor-grab px-3 py-2 text-left transition-colors hover:bg-mg-fg/5",
        isDragging && "opacity-40",
        FOCUS_RING
      )}
    >
      <span className="block text-[13px] font-medium">{block.label}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-mg-fg/45">
        {block.description}
      </span>
    </button>
  );
}
