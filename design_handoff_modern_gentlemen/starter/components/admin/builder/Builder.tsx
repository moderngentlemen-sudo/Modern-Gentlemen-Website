"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { clsx } from "@/components/ui/clsx";
import type { ActionResult, SerializedIssue } from "@/app/(admin)/admin/_lib/action-result";
import { HAIRLINE } from "@/components/admin/ui/styles";
import { manifestFor } from "@/lib/blocks/manifests";

import { BuilderStoreProvider, useBuilder } from "./StoreContext";
import { Canvas } from "./Canvas";
import { InsertMenu } from "./InsertMenu";
import { PropertiesPanel } from "./PropertiesPanel";
import { PublishBar } from "./PublishBar";
import { ValidationTray } from "./ValidationTray";
import { useAutosave } from "./useAutosave";
import { dropLocationFor, parseDragId, type DropLocation } from "./dnd";
import { locate } from "./tree";
import type { BuilderInit } from "./store";
import type { BlockTree } from "@/lib/blocks/types";

/**
 * The server actions the builder may call.
 *
 * These must be *references to the actions themselves*, not closures wrapping
 * them. A server action reference is serializable across the server→client
 * boundary; an ordinary arrow function created in a Server Component is not,
 * and Next refuses it at render time with "Functions cannot be passed directly
 * to Client Components". The route originally passed
 * `saveDraft: async (payload) => saveDraftAction({ id, payload })` and threw on
 * every load — invisible to `next build`, and invisible to the unit tests,
 * which hand `Builder` plain fakes.
 *
 * The document id is therefore applied here, on the client, where closing over
 * it is free.
 */
export interface BuilderServerActions {
  saveDraft: (input: {
    id: string;
    payload: Record<string, unknown>;
  }) => Promise<ActionResult<{ savedAt: string }>>;
  publish: (input: { id: string }) => Promise<ActionResult<{ version: number }>>;
  snapshot: (input: { id: string }) => Promise<ActionResult<{ version: number }>>;
  createPreview: (input: {
    id: string;
    device?: "desktop" | "tablet" | "mobile";
  }) => Promise<ActionResult<{ path: string; expiresAt: string }>>;
}

/** What the bar and the autosave hook consume, with the id already bound. */
export interface BuilderCallbacks {
  saveDraft: (payload: Record<string, unknown>) => Promise<ActionResult<{ savedAt: string }>>;
  publish: () => Promise<ActionResult<{ version: number }>>;
  snapshot: () => Promise<ActionResult<{ version: number }>>;
  createPreview: (
    device: "desktop" | "tablet" | "mobile"
  ) => Promise<ActionResult<{ path: string; expiresAt: string }>>;
}

export type { SerializedIssue };

/**
 * A pattern the rail may insert, with the blocks it would copy in.
 *
 * The blocks travel with the entry rather than being fetched on click: a
 * pattern's payload is already loaded server-side to build this list, and a
 * server round-trip on click would put a spinner in the middle of an operation
 * that is otherwise a local tree edit.
 */
export interface BuilderPattern {
  id: string;
  name: string;
  description: string | null;
  blockCount: number;
  blocks: BlockTree;
}

export function Builder({
  init,
  actions,
  canPublish,
  canPreview,
  patterns = [],
}: {
  init: BuilderInit;
  actions: BuilderServerActions;
  canPublish: boolean;
  canPreview: boolean;
  patterns?: BuilderPattern[];
}) {
  const id = init.doc.id;

  const callbacks: BuilderCallbacks = useMemo(
    () => ({
      saveDraft: (payload) => actions.saveDraft({ id, payload }),
      publish: () => actions.publish({ id }),
      snapshot: () => actions.snapshot({ id }),
      createPreview: (device) => actions.createPreview({ id, device }),
    }),
    [actions, id]
  );

  return (
    <BuilderStoreProvider init={init}>
      <BuilderLayout
        callbacks={callbacks}
        canPublish={canPublish}
        canPreview={canPreview}
        patterns={patterns}
      />
    </BuilderStoreProvider>
  );
}

function BuilderLayout({
  callbacks,
  canPublish,
  canPreview,
  patterns,
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
  patterns: BuilderPattern[];
}) {
  useAutosave(callbacks.saveDraft);

  const insert = useBuilder((s) => s.insert);
  const insertMany = useBuilder((s) => s.insertMany);
  const move = useBuilder((s) => s.move);
  const moveTo = useBuilder((s) => s.moveTo);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);

  /**
   * The library entry in flight, if any, and the insertion point under the
   * pointer — which names a container as well as an index now that a container
   * has a list of its own.
   *
   * `drop` is tracked for a *block* drag too, not only a library one: dropping
   * an existing block onto an empty container's placeholder is how it gets
   * moved in there.
   */
  const [libraryType, setLibraryType] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropLocation | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * `closestCenter` is right for sorting a column of tall blocks and wrong for
   * the thin gaps between them — it would keep resolving to a block's centre.
   * A library drag therefore switches to `pointerWithin`, which asks only what
   * is under the pointer.
   */
  const collisionDetection = useCallback<CollisionDetection>(
    (args) =>
      (parseDragId(args.active.id).kind === "library" ? pointerWithin : closestCenter)(args),
    []
  );

  function onDragStart(event: DragStartEvent) {
    const active = parseDragId(event.active.id);
    if (active.kind === "library") setLibraryType(active.type);
  }

  function onDragOver(event: DragOverEvent) {
    const next = dropLocationFor(event.over?.id);
    setDrop((current) =>
      current?.parentKey === (next?.parentKey ?? null) && current?.index === next?.index
        ? current
        : next
    );
  }

  function onDragEnd(event: DragEndEvent) {
    setLibraryType(null);
    setDrop(null);

    const active = parseDragId(event.active.id);
    const overId = event.over?.id;
    const location = dropLocationFor(overId);

    if (active.kind === "library") {
      if (location) insert(active.type, location.index, location.parentKey);
      return;
    }

    if (active.kind !== "block" || overId === undefined) return;

    // A block onto an insertion point — today that is an empty container's
    // placeholder, which is the only way into one.
    if (location) {
      moveTo(active.key, location.parentKey, location.index);
      return;
    }

    // Block onto block, unchanged — and cross-container for free, since
    // `moveByKey` works on locations rather than root indexes.
    const over = parseDragId(overId);
    if (over.kind === "block" && over.key !== active.key) move(active.key, over.key);
  }

  return (
    <div className="flex h-screen flex-col">
      <PublishBar callbacks={callbacks} canPublish={canPublish} canPreview={canPreview} />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setLibraryType(null);
          setDrop(null);
        }}
      >
        <div className="flex min-h-0 flex-1">
          <aside className={clsx("w-[230px] shrink-0 overflow-hidden border-r", HAIRLINE)}>
            <InsertMenu
              onInsert={(type) => {
                // Insert after whatever is selected, so building a page reads
                // top-to-bottom rather than always appending to the end — and
                // `locate`, not a root `findIndex`, so clicking with a block
                // inside a container selected adds the next one beside it
                // rather than silently at the end of the page.
                const at = selectedKey ? locate(tree, selectedKey) : null;
                insert(type, at ? at.index + 1 : undefined, at?.parentKey ?? null);
              }}
              patterns={patterns}
              onInsertPattern={(patternId) => {
                const pattern = patterns.find((entry) => entry.id === patternId);
                if (!pattern) return;

                // Same placement rule as a section: after the selection, so a
                // pattern lands where the editor is working rather than at the
                // end of the page.
                const at = selectedKey ? locate(tree, selectedKey) : null;
                insertMany(pattern.blocks, at ? at.index + 1 : undefined, at?.parentKey ?? null);
              }}
            />
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-mg-bg">
            <Canvas libraryDragType={libraryType} drop={drop} />
          </main>

          <aside className={clsx("w-[320px] shrink-0 overflow-hidden border-l", HAIRLINE)}>
            <PropertiesPanel />
          </aside>
        </div>

        {/*
          Crossing a 230px rail onto the canvas with nothing under the pointer
          reads as a broken interaction, not a minimal one — so the ghost is
          load-bearing rather than decoration.
        */}
        <DragOverlay dropAnimation={null}>
          {libraryType && (
            <div className="border border-mg-accent bg-mg-surface px-3 py-2 text-[13px] font-medium shadow-lg">
              {manifestFor(libraryType)?.label ?? libraryType}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ValidationTray />
    </div>
  );
}
