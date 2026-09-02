"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  useDndContext,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { clsx } from "@/components/ui/clsx";
import type { ActionResult, SerializedIssue } from "@/app/(admin)/admin/_lib/action-result";
import { HAIRLINE } from "@/components/admin/ui/styles";
import { manifestFor } from "@/lib/blocks/manifests";
import { areaNameOf } from "@/lib/blocks/areas";
import { findBlock } from "@/lib/blocks/traverse";

import { BuilderStoreProvider, useBuilder } from "./StoreContext";
import { PatternsProvider } from "./PatternsContext";
import { AreaSwitcher } from "./AreaSwitcher";
import { Canvas } from "./Canvas";
import { InsertMenu } from "./InsertMenu";
import { Navigator } from "./Navigator";
import { blockCatalogFor } from "@/components/sections/registry";
import { PropertiesPanel } from "./PropertiesPanel";
import { PublishBar } from "./PublishBar";
import { ValidationTray } from "./ValidationTray";
import { useAutosave } from "./useAutosave";
import { dropLocationFor, parseDragId, type DropLocation } from "./dnd";
import { dropTargetFor, locate } from "./tree";
import type { BuilderInit } from "./store";
import type { BlockTree } from "@/lib/blocks/types";
import type { ThemeStyleClass } from "@/lib/domain/theme";

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
    /**
     * The template area the builder has open, so the minted link points at the
     * tree the editor is actually looking at. Ignored by the five types that
     * keep one ordered tree — `areaNameOf` returns `null` for their `treeKey`,
     * and the template action is the only one whose schema accepts it.
     */
    area?: string;
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
  /** `synced` inserts a reference; `detachable` inserts a copy. See `onInsertPattern`. */
  syncMode: "synced" | "detachable";
  /** Whether it has a published payload — the live site expands nothing else. */
  published: boolean;
  /**
   * The heading the rail files this under. Optional so a caller that has not
   * been updated still type-checks; `InsertMenu` treats absent and null the
   * same, as the plain "Patterns" group it has always used.
   */
  category?: { label: string; position: number } | null;
}

export function Builder({
  init,
  actions,
  canPublish,
  canPreview,
  patterns = [],
  styleClasses = [],
}: {
  init: BuilderInit;
  actions: BuilderServerActions;
  canPublish: boolean;
  canPreview: boolean;
  patterns?: BuilderPattern[];
  styleClasses?: readonly ThemeStyleClass[];
}) {
  const id = init.doc.id;
  // `treeKey` is a payload *path*, and for a template it is `areas.<name>`.
  // Reading the open area off it here rather than adding a seventh field to
  // `BuilderDocument` keeps one source for "which tree is open" — the same one
  // the store commits through.
  const area = areaNameOf(init.doc.treeKey) ?? undefined;

  const callbacks: BuilderCallbacks = useMemo(
    () => ({
      saveDraft: (payload) => actions.saveDraft({ id, payload }),
      publish: () => actions.publish({ id }),
      snapshot: () => actions.snapshot({ id }),
      createPreview: (device) => actions.createPreview({ id, device, area }),
    }),
    [actions, id, area]
  );

  return (
    <BuilderStoreProvider init={init}>
      {/*
        The canvas needs the patterns too, not just the rail: a synced pattern
        is a `_ref` node carrying an id, and naming it on screen means looking
        that id up. See PatternsContext for why it is a context rather than a
        seventh prop threaded through a recursive component.
      */}
      <PatternsProvider patterns={patterns}>
        <BuilderLayout
          callbacks={callbacks}
          canPublish={canPublish}
          canPreview={canPreview}
          patterns={patterns}
          styleClasses={styleClasses}
        />
      </PatternsProvider>
    </BuilderStoreProvider>
  );
}

function BuilderLayout({
  callbacks,
  canPublish,
  canPreview,
  patterns,
  styleClasses,
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
  patterns: BuilderPattern[];
  styleClasses: readonly ThemeStyleClass[];
}) {
  useAutosave(callbacks.saveDraft);
  const [leftPanel, setLeftPanel] = useState<"add" | "navigator">("add");

  // `documentContent` is offered in a template and nowhere else — see
  // `blockCatalogFor`. Read from the store rather than threaded through props,
  // because the document type is already there and a second copy could disagree.
  const documentType = useBuilder((s) => s.doc.type);
  // Memoised for referential stability: `blockCatalogFor` builds a new array
  // each call, and the rail's grouping memo takes the catalogue as a dependency.
  const catalog = useMemo(() => blockCatalogFor(documentType), [documentType]);
  const insert = useBuilder((s) => s.insert);
  const insertMany = useBuilder((s) => s.insertMany);
  const insertPatternRef = useBuilder((s) => s.insertPatternRef);
  const move = useBuilder((s) => s.move);
  const moveTo = useBuilder((s) => s.moveTo);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);
  const { droppableRects } = useDndContext();

  /**
   * The library entry in flight, if any, and the insertion point under the
   * pointer — which names a container as well as an index now that a container
   * has a list of its own.
   *
   * `drop` is tracked for a *block* drag too, not only a library one: the same
   * location vocabulary now handles exact moves into non-empty containers as
   * well as the empty-slot case.
   */
  const [libraryType, setLibraryType] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropLocation | null>(null);
  const lastOverRef = useRef<string | number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Prefer an explicit gap whenever the pointer is inside one. `closestCenter`
   * is useful as the fallback for block-on-block sorting, but it skips over a
   * thin gap inside a populated container because the neighbouring block's
   * centre is always closer. The one exception is a column being reordered in
   * a horizontal row: its sibling's empty placeholder sits under the drag
   * handle, so pointer-first would resolve to that inner gap and reject the
   * move as a cycle instead of targeting the sibling column.
   */
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const active = parseDragId(args.active.id);
      if (active.kind === "block") {
        const home = locate(tree, active.key);
        const parent =
          home?.parentKey === null || home?.parentKey === undefined
            ? null
            : findBlock(tree, home.parentKey);
        if (parent && manifestFor(parent._type)?.slot?.direction === "horizontal") {
          // A column's empty placeholder fills the cell beneath its toolbar.
          // Exclude gap droppables for this sibling-reorder gesture so
          // `closestCenter` resolves the column (or one of its child blocks,
          // which `dropTargetFor` lifts back to the sibling) instead of trying
          // to nest the dragged column into that placeholder.
          const siblings = new Set(
            (parent.children ?? []).map((child) => child._key).filter((key) => key !== active.key)
          );
          return closestCenter({
            ...args,
            // A row's child columns are the only valid destinations for a
            // horizontal sibling reorder. Filtering to those direct wrappers
            // keeps the row itself, the dragged branch, and nested content
            // from winning the collision before the column under the pointer.
            droppableContainers: args.droppableContainers.filter((container) => {
              const candidate = parseDragId(container.id);
              return candidate.kind === "block" && siblings.has(candidate.key);
            }),
          });
        }
      }
      const pointerHits = pointerWithin(args);
      return pointerHits.length > 0 ? pointerHits : closestCenter(args);
    },
    [tree]
  );

  function onDragStart(event: DragStartEvent) {
    const active = parseDragId(event.active.id);
    lastOverRef.current = null;
    if (active.kind === "library") setLibraryType(active.type);
  }

  function onDragOver(event: DragOverEvent) {
    const active = parseDragId(event.active.id);
    const over = event.over?.id;
    if (over !== undefined && over !== null) {
      const parsedOver = parseDragId(over);
      if (!(
        active.kind === "block" &&
        parsedOver.kind === "block" &&
        parsedOver.key === active.key
      )) {
        lastOverRef.current = over;
      }
    }
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
    const eventOverId = event.over?.id;
    const eventOver = eventOverId === undefined ? null : parseDragId(eventOverId);
    const overId =
      eventOverId !== undefined &&
      !(active.kind === "block" && eventOver?.kind === "block" && eventOver.key === active.key)
        ? eventOverId
        : (lastOverRef.current ?? eventOverId);
    console.info("[builder:dnd:end]", {
      active: active.kind === "block" ? active.key : active.kind === "library" ? active.type : null,
      activeKind: active.kind,
      eventOverId,
      lastOver: lastOverRef.current,
      overId,
    });
    lastOverRef.current = null;
    const location = dropLocationFor(overId);

    if (active.kind === "library") {
      if (location) insert(active.type, location.index, location.parentKey);
      return;
    }

    // A pointer release can legitimately have no current droppable; the
    // horizontal sibling fallback below resolves that case from geometry.
    if (active.kind !== "block") return;

    // A block onto an insertion point — either a gap between siblings or an
    // empty container's placeholder.
    if (location) {
      /**
       * A horizontal row is the one container where a gap can be visually
       * underneath the intended target: an empty column's placeholder fills
       * the cell below its own drag handle. Treat that resolution as a sibling
       * column drop, not as moving one column inside another column.
       */
      const home = locate(tree, active.key);
      const homeParent =
        home?.parentKey === null || home?.parentKey === undefined
          ? null
          : findBlock(tree, home.parentKey);
      const destination = location.parentKey ? findBlock(tree, location.parentKey) : null;
      if (
        homeParent &&
        manifestFor(homeParent._type)?.slot?.direction === "horizontal" &&
        destination?._type === "column"
      ) {
        move(active.key, dropTargetFor(tree, active.key, destination._key));
        return;
      }
      moveTo(active.key, location.parentKey, location.index);
      return;
    }

    // Block onto block — and cross-container for free, since `moveByKey` works
    // on locations rather than root indexes.
    const over = overId === undefined ? null : parseDragId(overId);
    if (over?.kind === "block" && over.key !== active.key) {
      move(active.key, dropTargetFor(tree, active.key, over.key));
      return;
    }

    /**
     * Pointer sensors can report no `over` (or the active block itself) when
     * the final move lands on a toolbar edge. Horizontal rows still have an
     * unambiguous destination: choose the nearest measured direct sibling
     * using the active rectangle's final translated position. This keeps a
     * release-time miss from turning a valid column reorder into a no-op.
     */
    const home = locate(tree, active.key);
    const parent =
      home?.parentKey === null || home?.parentKey === undefined
        ? null
        : findBlock(tree, home.parentKey);
    console.info("[builder:dnd:fallback]", {
      home,
      parentType: parent?._type,
      siblings: parent?.children?.map((child) => child._key),
      hasTranslated: Boolean(
        event.active.rect.current.translated ?? event.active.rect.current.initial
      ),
    });
    if (!parent || manifestFor(parent._type)?.slot?.direction !== "horizontal") return;

    const siblings = (parent.children ?? []).filter((child) => child._key !== active.key);
    if (siblings.length === 0) return;

    /**
     * A two-column row has exactly one legal destination when the pointer
     * leaves every droppable at release. The browser may not provide a final
     * translated rect in that edge case, but the tree still gives us a
     * deterministic target. Resolve it before relying on optional geometry.
     */
    if (siblings.length === 1) {
      move(active.key, siblings[0]._key);
      return;
    }

    const translated = event.active.rect.current.translated ?? event.active.rect.current.initial;
    if (!translated) return;

    const centerX = translated.left + translated.width / 2;
    const centerY = translated.top + translated.height / 2;
    const nearest = siblings
      .map((sibling) => {
        const rect = droppableRects.get(sibling._key);
        if (!rect) return null;
        const dx = rect.left + rect.width / 2 - centerX;
        const dy = rect.top + rect.height / 2 - centerY;
        return { key: sibling._key, distance: dx * dx + dy * dy };
      })
      .filter((candidate): candidate is { key: string; distance: number } => candidate !== null)
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) move(active.key, nearest.key);
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
          <aside
            className={clsx("flex w-[230px] shrink-0 flex-col overflow-hidden border-r", HAIRLINE)}
          >
            <div className={clsx("grid grid-cols-2 border-b p-1", HAIRLINE)}>
              {(["add", "navigator"] as const).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  aria-pressed={leftPanel === panel}
                  onClick={() => setLeftPanel(panel)}
                  className={clsx(
                    "px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                    leftPanel === panel ? "bg-mg-fg text-mg-bg" : "text-mg-fg/60 hover:bg-mg-fg/5"
                  )}
                >
                  {panel === "add" ? "Add" : "Navigator"}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {leftPanel === "add" ? (
                <InsertMenu
                  catalog={catalog}
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
                    const index = at ? at.index + 1 : undefined;
                    const parentKey = at?.parentKey ?? null;

                    /**
                     * **The pattern's own `sync_mode` decides which of these two
                     * very different things "insert" means**, and the editor is not
                     * asked. A synced pattern stores a pointer, so editing it later
                     * updates every page using it; a detachable one copies its
                     * blocks in and forgets where they came from.
                     *
                     * Deciding per-insertion instead would make that promise true
                     * of some usages of a pattern and false of others, which is
                     * precisely the thing nobody could reason about afterwards.
                     */
                    if (pattern.syncMode === "synced") {
                      insertPatternRef(pattern.id, index, parentKey);
                    } else {
                      insertMany(pattern.blocks, index, parentKey);
                    }
                  }}
                />
              ) : (
                <Navigator />
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-mg-bg">
            {/*
              Renders nothing unless the document has areas, so the layout does
              not need to know which types do. A template is the only one today.
            */}
            <AreaSwitcher />
            <Canvas libraryDragType={libraryType} drop={drop} />
          </main>

          <aside className={clsx("w-[320px] shrink-0 overflow-hidden border-l", HAIRLINE)}>
            <PropertiesPanel styleClasses={styleClasses} />
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
