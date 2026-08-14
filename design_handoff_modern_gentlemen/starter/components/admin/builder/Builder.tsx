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
import { dropIndexFor, parseDragId } from "./dnd";
import type { BuilderInit } from "./store";

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

export function Builder({
  init,
  actions,
  canPublish,
  canPreview,
}: {
  init: BuilderInit;
  actions: BuilderServerActions;
  canPublish: boolean;
  canPreview: boolean;
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
      <BuilderLayout callbacks={callbacks} canPublish={canPublish} canPreview={canPreview} />
    </BuilderStoreProvider>
  );
}

function BuilderLayout({
  callbacks,
  canPublish,
  canPreview,
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
}) {
  useAutosave(callbacks.saveDraft);

  const insert = useBuilder((s) => s.insert);
  const move = useBuilder((s) => s.move);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);

  /** The library entry in flight, and the gap under the pointer. */
  const [libraryDrag, setLibraryDrag] = useState<{ type: string; index: number | null } | null>(
    null
  );

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
    if (active.kind === "library") setLibraryDrag({ type: active.type, index: null });
  }

  function onDragOver(event: DragOverEvent) {
    const index = dropIndexFor(event.over?.id, tree.length);
    setLibraryDrag((current) =>
      current === null || current.index === index ? current : { ...current, index }
    );
  }

  function onDragEnd(event: DragEndEvent) {
    setLibraryDrag(null);

    const active = parseDragId(event.active.id);
    const overId = event.over?.id;

    if (active.kind === "library") {
      const index = dropIndexFor(overId, tree.length);
      if (index !== null) insert(active.type, index);
      return;
    }

    if (active.kind !== "block" || overId === undefined) return;

    // Reordering is unchanged: block onto block, and never onto a gap.
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
        onDragCancel={() => setLibraryDrag(null)}
      >
        <div className="flex min-h-0 flex-1">
          <aside className={clsx("w-[230px] shrink-0 overflow-hidden border-r", HAIRLINE)}>
            <InsertMenu
              onInsert={(type) => {
                // Insert after whatever is selected, so building a page reads
                // top-to-bottom rather than always appending to the end.
                const index = tree.findIndex((node) => node._key === selectedKey);
                insert(type, index === -1 ? undefined : index + 1);
              }}
            />
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-mg-bg">
            <Canvas
              libraryDragType={libraryDrag?.type ?? null}
              dropIndex={libraryDrag?.index ?? null}
            />
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
          {libraryDrag && (
            <div className="border border-mg-accent bg-mg-surface px-3 py-2 text-[13px] font-medium shadow-lg">
              {manifestFor(libraryDrag.type)?.label ?? libraryDrag.type}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ValidationTray />
    </div>
  );
}
