/**
 * The builder's editing state.
 *
 * Three decisions worth knowing before changing anything here.
 *
 * **It is a store factory, not a module singleton.** `createBuilderStore` is
 * called per document and held in React context. A singleton would leak one
 * page's tree, undo history and dirty flag into the next document opened in the
 * same session.
 *
 * **Undo is cheap because immer shares structure.** Every mutation runs through
 * `commit`, which pushes the *previous tree reference* onto `past`. A 40-block
 * page with 50 undo levels costs 50 pointers plus the handful of nodes that
 * actually changed — not 50 deep copies. This is exactly why `lib/blocks/
 * traverse.ts#mapBlocks` was written non-mutating, and why nothing here may
 * mutate a tree outside `produce`.
 *
 * **It performs no I/O and imports no service.** Persistence arrives as
 * injected async callbacks, the same shape `lib/blocks/binding.ts` uses for its
 * sources. That keeps the store unit-testable with fakes and keeps
 * `components/**` clear of the repository/service layering rules.
 *
 * zustand v5 note: v5 dropped the default shallow comparison, so a selector
 * returning a fresh object or array re-renders forever. Keep selectors atomic,
 * or wrap them in `useShallow`.
 */

import { enableMapSet, produce, type Draft } from "immer";
import { createStore, type StoreApi } from "zustand";

import { validateTree, type BlockIssue } from "@/lib/blocks/validate";
import { findBlock } from "@/lib/blocks/traverse";
import {
  areaNameOf,
  areaTreeKey,
  isAreaName,
  readArea,
  readAreas,
  withArea,
  withRenamedArea,
  withoutArea,
} from "@/lib/blocks/areas";
import type { BlockDesign, BlockNode, BlockTree, BlockVisibility } from "@/lib/blocks/types";
import { stampBuilderPayload } from "@/lib/blocks/document";
import type { VisualBreakpoint, VisualEffects, VisualStyle } from "@/lib/blocks/visual";
import type { DocumentStatus, DocumentType } from "@/lib/domain/documents";

import { moveIndex } from "./dnd";
import { insertAfter, insertAt, locate, moveByKey, moveInto, removeByKey } from "./tree";
import { cloneJson, cloneWithNewKeys, keysOf, newBlockNode } from "./node";

enableMapSet();

/** How many trees the undo stack holds before dropping the oldest. */
export const HISTORY_LIMIT = 50;

/**
 * Edits to the same field within this window collapse into one undo entry, so
 * typing a headline is one undo rather than one per keystroke. Structural
 * changes pass no tag and never coalesce.
 */
export const COALESCE_MS = 600;

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

export interface BuilderDocument {
  type: DocumentType;
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  /**
   * Where in the payload the tree being edited lives — a *path*, not a key.
   *
   * For the five one-tree types it is one segment: `sections`, or `blocks` for
   * a pattern. A template holds named areas, so its path is `areas.<name>` and
   * names the area currently open. `areaNameOf` is the only thing that should
   * take that string apart.
   */
  treeKey: string;
  /**
   * Everything in draft_data that is not the tree being edited (seo, and so on).
   *
   * For a template this **also holds every area**, including a possibly stale
   * copy of the open one — `payload()` overwrites that from `tree` on the way
   * out, and `setArea` writes it back before switching. Keeping every area here
   * is what lets one save carry the whole document.
   */
  rest: Record<string, unknown>;
  /**
   * Every area name, when the document has areas at all. Absent for the five
   * one-tree types, which is what the UI keys off to show no switcher.
   */
  areaNames?: readonly string[];
}

export interface BuilderState {
  doc: BuilderDocument;
  tree: BlockTree;
  /** The last tree the server acknowledged. Dirtiness is a reference comparison. */
  savedTree: BlockTree;
  dirty: boolean;
  selectedKey: string | null;
  /** Ordered selection; `selectedKey` remains the active/last-selected block. */
  selectedKeys: string[];
  hoveredKey: string | null;
  device: "desktop" | "tablet" | "mobile";
  canvasZoom: number;
  showRulers: boolean;
  snapToGrid: boolean;
  /** Local validation, recomputed on every structural or field change. */
  issues: BlockIssue[];
  /**
   * How many issues each area holds, for a document that has areas.
   *
   * `issues` covers the open area only, because that is the only tree the store
   * holds as a tree. Publish validates **every** area, so without this the tray
   * could say "no issues" while publish refused the document over a block in an
   * area nobody was looking at — the exact shape of failure this codebase keeps
   * finding. Recounted wherever `issues` is, and `{}` for the one-tree types.
   */
  areaIssues: Record<string, number>;
  /**
   * Whether an area other than the open one has unsaved edits.
   *
   * Dirtiness elsewhere is otherwise unrepresentable: `dirty` is a reference
   * comparison of `tree` against `savedTree`, and the moment `setArea` swaps
   * both, an edit sitting in `rest` becomes invisible to it. Undoing back to
   * the loaded state in the newly-opened area would then clear `dirty` and the
   * other area's work would never be sent. Cleared by a save that observably
   * carried it.
   */
  dirtyElsewhere: boolean;
  /** Issues returned by a failed publish. Cleared when the editor edits again. */
  serverIssues: BlockIssue[];
  past: BlockTree[];
  future: BlockTree[];
  historyTag: string | null;
  historyAt: number;
  save: SaveStatus;
}

export interface BuilderActions {
  select: (key: string | null, additive?: boolean) => void;
  hover: (key: string | null) => void;
  setDevice: (device: BuilderState["device"]) => void;
  setCanvasZoom: (zoom: number) => void;
  toggleRulers: () => void;
  toggleSnapToGrid: () => void;

  /**
   * `parentKey` names the container to insert into; the root when omitted.
   * Kept as a third positional argument rather than an options object so every
   * existing call site — and the whole click-to-insert path — is untouched.
   */
  insert: (type: string, at?: number, parentKey?: string | null) => void;
  /**
   * Insert a ready-made group of blocks — a pattern — as a copy.
   *
   * Separate from `insert` because that one builds a single empty block from a
   * type name, while this one is handed real content to clone.
   */
  insertMany: (nodes: BlockTree, at?: number, parentKey?: string | null) => void;
  /**
   * Insert a *reference* to a pattern rather than a copy of it.
   *
   * This is the whole of what `sync_mode: 'synced'` means in the tree: one
   * `patternRef` node carrying `_ref`, which the public path substitutes for the
   * pattern's blocks at render time. Separate from `insertMany` because the two
   * are opposite operations — that one clones content in and forgets where it
   * came from, this one stores a pointer and keeps no content at all.
   */
  insertPatternRef: (patternId: string, at?: number, parentKey?: string | null) => void;
  /**
   * Replace a synced reference with a copy of the blocks it points at.
   *
   * The one-way door out of syncing, and the reason a synced pattern is not a
   * trap: an editor who needs this page's copy to differ detaches it and edits
   * freely. Keys are freshly minted, so the copy is ordinary content with no
   * relationship to the pattern afterwards.
   */
  detachPatternRef: (key: string, blocks: BlockTree) => void;
  duplicate: (key: string) => void;
  remove: (key: string) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  move: (activeKey: string, overKey: string) => void;
  /** The drop-into-a-gap case: a position rather than another block. */
  moveTo: (activeKey: string, parentKey: string | null, index: number) => void;

  setSetting: (key: string, path: (string | number)[], value: unknown) => void;
  unsetSetting: (key: string, path: (string | number)[]) => void;
  listAdd: (key: string, path: (string | number)[], item: unknown) => void;
  listRemove: (key: string, path: (string | number)[], index: number) => void;
  listMove: (key: string, path: (string | number)[], from: number, to: number) => void;

  setVisibility: (key: string, patch: Partial<BlockVisibility>) => void;
  setDesign: (key: string, patch: Partial<BlockDesign>) => void;
  setVisualStyle: (key: string, breakpoint: VisualBreakpoint, patch: Partial<VisualStyle>) => void;
  setSelectedVisibility: (patch: Partial<BlockVisibility>) => void;
  setSelectedDesign: (patch: Partial<BlockDesign>) => void;
  setSelectedVisualStyle: (breakpoint: VisualBreakpoint, patch: Partial<VisualStyle>) => void;
  setSelectedLocked: (locked: boolean) => void;
  setVisualEffects: (key: string, patch: Partial<VisualEffects>) => void;
  setVisualName: (key: string, name: string | undefined) => void;
  setLocked: (key: string, locked: boolean) => void;

  /**
   * Open another area.
   *
   * The outgoing tree is written back into `rest` first, so nothing is lost and
   * one save still carries the whole document. History does **not** survive the
   * switch: an undo stack holding another area's trees would restore blocks
   * into the wrong area, which is worse than not being able to undo across one.
   */
  setArea: (name: string) => void;
  /**
   * Add an empty area and open it. Returns an error message, or `null`.
   *
   * The three area operations report rather than throw because each is driven
   * by a dialog that has somewhere to put the message, and because a refusal
   * here is an editor mistake — a duplicate name — not a bug.
   */
  addArea: (name: string) => string | null;
  /** Rename an area, keeping its blocks. Returns an error message, or `null`. */
  renameArea: (from: string, to: string) => string | null;
  /** Delete an area **and its blocks**. Returns an error message, or `null`. */
  removeArea: (name: string) => string | null;

  undo: () => void;
  redo: () => void;

  payload: () => Record<string, unknown>;
  markSaving: () => void;
  markSaved: (sentTree: BlockTree, sentRest: Record<string, unknown>) => void;
  markSaveError: (message: string) => void;
  setServerIssues: (issues: BlockIssue[]) => void;
  /**
   * Patches the document's own metadata — status and version.
   *
   * Publishing changes both, but the store is seeded once from the server
   * payload and `router.refresh()` re-renders the server component without
   * re-seeding it: `BuilderStoreProvider` holds its store in a ref by design,
   * so one document keeps one store. Without this the bar went on showing
   * "draft" and the old version number after a successful publish, until a full
   * page reload.
   */
  setDoc: (patch: Partial<BuilderDocument>) => void;
  replaceTree: (tree: BlockTree, doc?: Partial<BuilderDocument>) => void;
}

export type BuilderStore = StoreApi<BuilderState & BuilderActions>;

export interface BuilderInit {
  doc: BuilderDocument;
  tree: BlockTree;
}

/** Reads a nested value, creating nothing. */
function readIn(root: Record<string, unknown>, path: (string | number)[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

/** Tree-order selection with descendants suppressed when their ancestor is selected. */
function topmostSelection(
  tree: BlockTree,
  selected: ReadonlySet<string>,
  ancestorSelected = false
): string[] {
  const out: string[] = [];
  for (const node of tree) {
    const currentSelected = selected.has(node._key);
    if (currentSelected && !ancestorSelected) out.push(node._key);
    if (node.children) {
      out.push(...topmostSelection(node.children, selected, ancestorSelected || currentSelected));
    }
  }
  return out;
}

function selectionForTree(tree: BlockTree, keys: readonly string[], active: string | null) {
  const selectedKeys = keys.filter((key) => findBlock(tree, key));
  return {
    selectedKeys,
    selectedKey: active && selectedKeys.includes(active) ? active : (selectedKeys.at(-1) ?? null),
  };
}

/**
 * Writes a nested value, creating intermediate containers.
 *
 * The container kind comes from the *next* path segment: a number means the
 * missing level is an array. Getting this backwards produces objects with "0"
 * keys that look right in the panel and serialise wrongly.
 */
function writeIn(root: Record<string, unknown>, path: (string | number)[], value: unknown): void {
  let current: Record<string | number, unknown> = root;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const existing = current[segment];
    if (existing === null || typeof existing !== "object") {
      current[segment] = typeof path[i + 1] === "number" ? [] : {};
    }
    current = current[segment] as Record<string | number, unknown>;
  }

  current[path[path.length - 1]] = value;
}

/**
 * The node with `key`, anywhere in an immer draft.
 *
 * `traverse.ts#findBlock` cannot serve here: it takes a `BlockTree`, and a
 * draft's nodes are `Draft<BlockNode>` — mutating what it returned would write
 * to a copy immer never finalises, so the edit would vanish with no error. The
 * two recursions are deliberately separate for that reason.
 */
function findDraft(list: Draft<BlockNode>[], key: string): Draft<BlockNode> | undefined {
  for (const node of list) {
    if (node._key === key) return node;
    if (Array.isArray(node.children)) {
      const found = findDraft(node.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

function deleteIn(root: Record<string, unknown>, path: (string | number)[]): void {
  const parent = path.length === 1 ? root : readIn(root, path.slice(0, -1));
  if (parent === null || typeof parent !== "object") return;

  const last = path[path.length - 1];
  if (Array.isArray(parent) && typeof last === "number") parent.splice(last, 1);
  else delete (parent as Record<string | number, unknown>)[last];
}

/**
 * Every area's issue count for a document that has areas, `{}` for one that
 * does not.
 *
 * `openTree` is passed separately because the open area's copy inside `rest` is
 * allowed to be stale — the store holds the live one as `tree`. Reading the
 * count out of `rest` instead would report the last-switched-away state.
 */
function countAreaIssues(doc: BuilderDocument, openTree: BlockTree): Record<string, number> {
  if (!doc.areaNames) return {};

  const open = areaNameOf(doc.treeKey);
  const areas = readAreas(doc.rest);
  const counts: Record<string, number> = {};

  for (const name of doc.areaNames) {
    const tree = name === open ? openTree : (areas[name] ?? []);
    counts[name] = validateTree(tree).issues.length;
  }
  return counts;
}

/**
 * The area counts with the open area's replaced.
 *
 * Undo and redo change the open tree without going through `commit`, so they
 * need the same one-key update it does. A whole recount would revalidate every
 * other area to arrive at the numbers it already had.
 */
function areaIssuesWith(state: BuilderState, count: number): Record<string, number> {
  const open = areaNameOf(state.doc.treeKey);
  return open === null ? state.areaIssues : { ...state.areaIssues, [open]: count };
}

export function createBuilderStore(init: BuilderInit): BuilderStore {
  return createStore<BuilderState & BuilderActions>()((set, get) => {
    /**
     * The single write path. Everything structural or field-level goes through
     * here so history, dirtiness and validation cannot drift out of step.
     *
     * `tag` non-null enables coalescing with the immediately preceding edit to
     * the same target.
     */
    function commit(tag: string | null, recipe: (tree: Draft<BlockTree>) => void): void {
      const state = get();
      const before = state.tree;
      const next = produce(before, recipe);
      if (next === before) return; // recipe was a no-op (locked node, bad path)

      const now = Date.now();
      const coalesce =
        tag !== null && state.historyTag === tag && now - state.historyAt < COALESCE_MS;

      const past = coalesce ? state.past : [...state.past, before].slice(-HISTORY_LIMIT);
      const issues = validateTree(next).issues;
      const open = areaNameOf(state.doc.treeKey);

      set({
        tree: next,
        past,
        future: [],
        historyTag: tag,
        historyAt: now,
        // `dirtyElsewhere` is what stops an undo back to this area's loaded
        // state reporting the whole document clean while another area's edits
        // are still only in `rest`.
        dirty: next !== state.savedTree || state.dirtyElsewhere,
        issues,
        // Only the open area's count can have moved; the others' trees are
        // untouched by a tree edit, so they are not revalidated.
        areaIssues:
          open === null ? state.areaIssues : { ...state.areaIssues, [open]: issues.length },
        serverIssues: [],
        save: state.save.kind === "saving" ? state.save : { kind: "dirty" },
      });
    }

    /**
     * Commits a tree that a pure function in `tree.ts` has already built.
     *
     * Structural edits are done there rather than inside a `produce` recipe
     * because they need to reach into a container the root array cannot name.
     * The history, dirtiness and validation bookkeeping is `commit`'s either
     * way, so this routes through it rather than around it — the recipe simply
     * swaps the contents. **An unchanged tree returns early**, which is what
     * keeps a refused move (a container into its own subtree, a drop on the gap
     * a block already occupies) out of the undo stack.
     */
    function replaceWith(next: BlockTree): void {
      if (next === get().tree) return;
      commit(null, (draft) => {
        draft.length = 0;
        draft.push(...(next as Draft<BlockTree>));
      });
    }

    /** Field mutations are refused on a locked block rather than silently applied. */
    function editSettings(
      key: string,
      tag: string | null,
      edit: (settings: Record<string, unknown>) => void
    ): void {
      if (findBlock(get().tree, key)?.locked) return;

      commit(tag, (draft) => {
        const node = findDraft(draft, key);
        if (!node) return;
        if (!node.settings) node.settings = {};
        edit(node.settings as Record<string, unknown>);
      });
    }

    return {
      doc: init.doc,
      tree: init.tree,
      savedTree: init.tree,
      dirty: false,
      dirtyElsewhere: false,
      selectedKey: null,
      selectedKeys: [],
      hoveredKey: null,
      device: "desktop",
      canvasZoom: 1,
      showRulers: false,
      snapToGrid: true,
      issues: validateTree(init.tree).issues,
      areaIssues: countAreaIssues(init.doc, init.tree),
      serverIssues: [],
      past: [],
      future: [],
      historyTag: null,
      historyAt: 0,
      save: { kind: "idle" },

      select: (key, additive = false) =>
        set((state) => {
          if (key === null) return { selectedKey: null, selectedKeys: [] };
          if (!additive) return { selectedKey: key, selectedKeys: [key] };
          const selectedKeys = state.selectedKeys.includes(key)
            ? state.selectedKeys.filter((entry) => entry !== key)
            : [...state.selectedKeys, key];
          return { selectedKey: selectedKeys.at(-1) ?? null, selectedKeys };
        }),
      hover: (key) => set({ hoveredKey: key }),
      setDevice: (device) => set({ device }),
      setCanvasZoom: (zoom) => set({ canvasZoom: Math.min(1.5, Math.max(0.5, zoom)) }),
      toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      insert: (type, at, parentKey = null) => {
        const node = newBlockNode(type, keysOf(get().tree));
        replaceWith(insertAt(get().tree, node, parentKey, at));
        set({ selectedKey: node._key, selectedKeys: [node._key] });
      },

      insertMany: (nodes, at, parentKey = null) => {
        if (nodes.length === 0) return;

        // The taken set is threaded across the whole batch rather than
        // recomputed per node. `cloneWithNewKeys` only avoids the keys it is
        // handed, so cloning each node against `keysOf(tree)` alone would let
        // two blocks *within the same pattern* draw the same key — a tree that
        // fails its own duplicate-key validation, produced by an operation the
        // editor would have no reason to suspect.
        const taken = new Set(keysOf(get().tree));
        const clones = nodes.map((node) => {
          const clone = cloneWithNewKeys(node, taken);
          for (const key of keysOf([clone])) taken.add(key);
          return clone;
        });

        // Inserted one at a time so the group keeps its order at the drop
        // point; `insertAt` with an undefined index appends, which is the
        // click-to-insert-at-the-end case.
        let tree = get().tree;
        clones.forEach((clone, offset) => {
          tree = insertAt(tree, clone, parentKey, at === undefined ? undefined : at + offset);
        });

        replaceWith(tree);
        set({ selectedKey: clones[0]._key, selectedKeys: clones.map((clone) => clone._key) });
      },

      insertPatternRef: (patternId, at, parentKey = null) => {
        const node = newBlockNode("patternRef", keysOf(get().tree));
        // `_ref` sits beside `_key` and `_type`, not in `settings` — see the
        // `patternRef` manifest for why it has no fields at all.
        replaceWith(insertAt(get().tree, { ...node, _ref: patternId }, parentKey, at));
        set({ selectedKey: node._key, selectedKeys: [node._key] });
      },

      detachPatternRef: (key, blocks) => {
        const at = locate(get().tree, key);
        if (at === null || blocks.length === 0) return;

        // Cloned against the keys of the tree *without* the ref node, and
        // threaded across the batch for the same reason `insertMany` does it:
        // cloning each block against the original key set alone would let two
        // blocks from one pattern draw the same key.
        const withoutRef = removeByKey(get().tree, key);
        const taken = new Set(keysOf(withoutRef));
        const clones = blocks.map((block) => {
          const clone = cloneWithNewKeys(block, taken);
          for (const cloneKey of keysOf([clone])) taken.add(cloneKey);
          return clone;
        });

        let tree = withoutRef;
        clones.forEach((clone, offset) => {
          tree = insertAt(tree, clone, at.parentKey, at.index + offset);
        });

        replaceWith(tree);
        set({
          selectedKey: clones[0]?._key ?? null,
          selectedKeys: clones.map((clone) => clone._key),
        });
      },

      duplicate: (key) => {
        const state = get();
        // `findBlock` rather than `tree.find`: a nested block is duplicable
        // too, and its copy belongs beside it rather than at the root.
        const source = findBlock(state.tree, key);
        if (!source) return;

        const copy = cloneWithNewKeys(source, keysOf(state.tree));
        replaceWith(insertAfter(state.tree, key, copy));
        set({ selectedKey: copy._key, selectedKeys: [copy._key] });
      },

      remove: (key) => {
        const next = removeByKey(get().tree, key);
        replaceWith(next);
        const alive = new Set(keysOf(next));
        const selectedKeys = get().selectedKeys.filter((entry) => alive.has(entry));
        set({ selectedKey: selectedKeys.at(-1) ?? null, selectedKeys });
      },

      duplicateSelected: () => {
        const state = get();
        const selected = topmostSelection(state.tree, new Set(state.selectedKeys)).filter(
          (key) => !findBlock(state.tree, key)?.locked
        );
        if (selected.length === 0) return;
        let tree = state.tree;
        const taken = new Set(keysOf(tree));
        const copies: BlockNode[] = [];
        for (const key of selected) {
          const source = findBlock(tree, key);
          if (!source) continue;
          const copy = cloneWithNewKeys(source, taken);
          for (const copyKey of keysOf([copy])) taken.add(copyKey);
          tree = insertAfter(tree, key, copy);
          copies.push(copy);
        }
        replaceWith(tree);
        set({
          selectedKey: copies.at(-1)?._key ?? null,
          selectedKeys: copies.map((copy) => copy._key),
        });
      },

      removeSelected: () => {
        const state = get();
        const selected = topmostSelection(state.tree, new Set(state.selectedKeys)).filter(
          (key) => !findBlock(state.tree, key)?.locked
        );
        if (selected.length === 0) return;
        let tree = state.tree;
        for (const key of selected) tree = removeByKey(tree, key);
        replaceWith(tree);
        set({ selectedKey: null, selectedKeys: [] });
      },

      move: (activeKey, overKey) => replaceWith(moveByKey(get().tree, activeKey, overKey)),

      moveTo: (activeKey, parentKey, index) =>
        replaceWith(moveInto(get().tree, activeKey, parentKey, index)),

      setSetting: (key, path, value) =>
        editSettings(key, `set:${key}:${path.join(".")}`, (settings) =>
          writeIn(settings, path, value)
        ),

      unsetSetting: (key, path) => editSettings(key, null, (settings) => deleteIn(settings, path)),

      listAdd: (key, path, item) =>
        editSettings(key, null, (settings) => {
          const list = readIn(settings, path);
          if (Array.isArray(list)) list.push(cloneJson(item));
          else writeIn(settings, path, [cloneJson(item)]);
        }),

      listRemove: (key, path, index) =>
        editSettings(key, null, (settings) => {
          const list = readIn(settings, path);
          if (Array.isArray(list)) list.splice(index, 1);
        }),

      listMove: (key, path, from, to) =>
        editSettings(key, null, (settings) => {
          const list = readIn(settings, path);
          if (Array.isArray(list)) writeIn(settings, path, moveIndex(list, from, to));
        }),

      setVisibility: (key, patch) =>
        commit(null, (draft) => {
          const node = findDraft(draft, key);
          if (!node) return;
          node.visibility = { ...node.visibility, ...patch };
        }),

      setDesign: (key, patch) =>
        commit(null, (draft) => {
          const node = findDraft(draft, key);
          if (!node) return;
          node.design = { ...node.design, ...patch };
        }),

      setVisualStyle: (key, breakpoint, patch) =>
        commit(`visual:${key}:${breakpoint}`, (draft) => {
          const node = findDraft(draft, key);
          if (!node || node.locked) return;
          if (!node.visual) node.visual = {};
          if (!node.visual.styles) node.visual.styles = {};
          const style = { ...(node.visual.styles[breakpoint] ?? {}) } as Record<string, unknown>;
          for (const [property, value] of Object.entries(patch)) {
            if (value === undefined) delete style[property];
            else style[property] = value;
          }
          node.visual.styles[breakpoint] = style;
        }),

      setSelectedVisibility: (patch) =>
        commit(null, (draft) => {
          for (const key of get().selectedKeys) {
            const node = findDraft(draft, key);
            if (node && !node.locked) node.visibility = { ...node.visibility, ...patch };
          }
        }),

      setSelectedDesign: (patch) =>
        commit(null, (draft) => {
          for (const key of get().selectedKeys) {
            const node = findDraft(draft, key);
            if (node && !node.locked) node.design = { ...node.design, ...patch };
          }
        }),

      setSelectedVisualStyle: (breakpoint, patch) =>
        commit(null, (draft) => {
          for (const key of get().selectedKeys) {
            const node = findDraft(draft, key);
            if (!node || node.locked) continue;
            if (!node.visual) node.visual = {};
            if (!node.visual.styles) node.visual.styles = {};
            const style = { ...(node.visual.styles[breakpoint] ?? {}) } as Record<string, unknown>;
            for (const [property, value] of Object.entries(patch)) {
              if (value === undefined) delete style[property];
              else style[property] = value;
            }
            node.visual.styles[breakpoint] = style;
          }
        }),

      setSelectedLocked: (locked) =>
        commit(null, (draft) => {
          for (const key of get().selectedKeys) {
            const node = findDraft(draft, key);
            if (node) node.locked = locked;
          }
        }),

      setVisualEffects: (key, patch) =>
        commit(`visual-effects:${key}`, (draft) => {
          const node = findDraft(draft, key);
          if (!node || node.locked) return;
          if (!node.visual) node.visual = {};
          const effects = { ...(node.visual.effects ?? {}) } as Record<string, unknown>;
          for (const [property, value] of Object.entries(patch)) {
            if (value === undefined) delete effects[property];
            else effects[property] = value;
          }
          node.visual.effects = effects;
        }),

      setVisualName: (key, name) =>
        commit(`visual-name:${key}`, (draft) => {
          const node = findDraft(draft, key);
          if (!node || node.locked) return;
          if (!node.visual) node.visual = {};
          if (name === undefined || name.trim() === "") delete node.visual.name;
          else node.visual.name = name.slice(0, 80);
        }),

      // Deliberately not routed through `editSettings`: locking a block must
      // work on a block that is already locked, or it could never be unlocked.
      setLocked: (key, locked) =>
        commit(null, (draft) => {
          const node = findDraft(draft, key);
          if (node) node.locked = locked;
        }),

      /**
       * Open another area.
       *
       * Deliberately **not** routed through `commit`. `commit` is the write
       * path for one tree's contents — it manages undo, and pushing a switch
       * onto that stack would make Undo restore the previous area's blocks into
       * this one. Everything `commit` guards is re-established here by hand
       * instead, which is why the `set` below is long rather than clever.
       */
      setArea: (name) => {
        const state = get();
        const open = areaNameOf(state.doc.treeKey);
        if (open === null || open === name) return;
        if (!state.doc.areaNames?.includes(name)) return;

        // The outgoing tree goes back into `rest` before anything else, so a
        // switch can never be the thing that loses an edit.
        const rest = withArea(state.doc.rest, open, state.tree);
        const next = readArea(rest, name);

        set({
          doc: { ...state.doc, treeKey: areaTreeKey(name), rest },
          tree: next,
          // The incoming area is "saved" as far as reference comparison goes;
          // whether the *document* is dirty is `dirtyElsewhere`'s job, and it
          // inherits whatever was outstanding before the switch.
          savedTree: next,
          dirty: state.dirty,
          dirtyElsewhere: state.dirty || state.dirtyElsewhere,
          issues: validateTree(next).issues,
          serverIssues: [],
          // Undo cannot span areas — see the comment above.
          past: [],
          future: [],
          historyTag: null,
          // A selection in the area being closed would leave the properties
          // panel editing a block the canvas no longer shows.
          selectedKey: null,
          selectedKeys: [],
          hoveredKey: null,
        });
      },

      addArea: (name) => {
        const state = get();
        const { areaNames } = state.doc;
        if (!areaNames) return "This document does not have areas.";
        if (!isAreaName(name)) return "Use lower-case words separated by hyphens.";
        if (areaNames.includes(name)) return `There is already an area called “${name}”.`;

        const open = areaNameOf(state.doc.treeKey);
        // Two writes: the outgoing tree, then the new empty area. Same ordering
        // rule as `setArea` — the open tree is banked before anything moves.
        const rest = withArea(
          open === null ? state.doc.rest : withArea(state.doc.rest, open, state.tree),
          name,
          []
        );
        const doc = {
          ...state.doc,
          treeKey: areaTreeKey(name),
          rest,
          areaNames: [...areaNames, name].sort(),
        };

        set({
          doc,
          tree: [],
          savedTree: [],
          // Adding an area changes the payload, so the document is dirty even
          // though no tree was edited. `useAutosave` watches `doc.rest` as well
          // as `tree` for exactly this.
          dirty: true,
          dirtyElsewhere: true,
          issues: [],
          areaIssues: { ...state.areaIssues, [name]: 0 },
          serverIssues: [],
          past: [],
          future: [],
          historyTag: null,
          selectedKey: null,
          selectedKeys: [],
          hoveredKey: null,
        });
        return null;
      },

      renameArea: (from, to) => {
        const state = get();
        const { areaNames } = state.doc;
        if (!areaNames) return "This document does not have areas.";
        if (!isAreaName(to)) return "Use lower-case words separated by hyphens.";
        if (from === to) return null;
        if (!areaNames.includes(from)) return `There is no area called “${from}”.`;
        if (areaNames.includes(to)) return `There is already an area called “${to}”.`;

        const open = areaNameOf(state.doc.treeKey);
        // Banked first again: renaming the *open* area moves a tree that only
        // the store holds, so `rest`'s copy has to be the current one before
        // `withRenamedArea` moves it.
        const banked = open === null ? state.doc.rest : withArea(state.doc.rest, open, state.tree);
        const rest = withRenamedArea(banked, from, to);

        const areaIssues = { ...state.areaIssues, [to]: state.areaIssues[from] ?? 0 };
        delete areaIssues[from];

        set({
          doc: {
            ...state.doc,
            rest,
            treeKey: open === from ? areaTreeKey(to) : state.doc.treeKey,
            areaNames: areaNames.map((entry) => (entry === from ? to : entry)).sort(),
          },
          dirty: true,
          dirtyElsewhere: true,
          areaIssues,
          serverIssues: [],
        });
        return null;
      },

      removeArea: (name) => {
        const state = get();
        const { areaNames } = state.doc;
        if (!areaNames) return "This document does not have areas.";
        if (!areaNames.includes(name)) return `There is no area called “${name}”.`;
        // A template with no areas has no tree the builder can open, so it
        // would become uneditable by exactly the screen that emptied it.
        if (areaNames.length === 1) return "A template needs at least one area.";

        const open = areaNameOf(state.doc.treeKey);
        const remaining = areaNames.filter((entry) => entry !== name);
        const banked = open === null ? state.doc.rest : withArea(state.doc.rest, open, state.tree);
        const rest = withoutArea(banked, name);

        // Removing the open area has to open another one, or the canvas would
        // be showing a tree that is no longer in the payload.
        const nextOpen = open === name ? remaining[0] : open;
        const tree = nextOpen === null ? state.tree : readArea(rest, nextOpen);

        const areaIssues = { ...state.areaIssues };
        delete areaIssues[name];

        set({
          doc: {
            ...state.doc,
            rest,
            treeKey: nextOpen === null ? state.doc.treeKey : areaTreeKey(nextOpen),
            areaNames: remaining,
          },
          tree,
          savedTree: tree,
          dirty: true,
          dirtyElsewhere: true,
          issues: validateTree(tree).issues,
          areaIssues,
          serverIssues: [],
          past: [],
          future: [],
          historyTag: null,
          selectedKey: null,
          selectedKeys: [],
          hoveredKey: null,
        });
        return null;
      },

      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous) return;

        set({
          tree: previous,
          past: state.past.slice(0, -1),
          future: [...state.future, state.tree],
          dirty: previous !== state.savedTree || state.dirtyElsewhere,
          issues: validateTree(previous).issues,
          areaIssues: areaIssuesWith(state, validateTree(previous).issues.length),
          serverIssues: [],
          historyTag: null,
          ...selectionForTree(previous, state.selectedKeys, state.selectedKey),
          save: { kind: "dirty" },
        });
      },

      redo: () => {
        const state = get();
        const next = state.future[state.future.length - 1];
        if (!next) return;

        set({
          tree: next,
          past: [...state.past, state.tree].slice(-HISTORY_LIMIT),
          future: state.future.slice(0, -1),
          dirty: next !== state.savedTree || state.dirtyElsewhere,
          issues: validateTree(next).issues,
          areaIssues: areaIssuesWith(state, validateTree(next).issues.length),
          serverIssues: [],
          historyTag: null,
          ...selectionForTree(next, state.selectedKeys, state.selectedKey),
          save: { kind: "dirty" },
        });
      },

      /**
       * The draft payload to send.
       *
       * `treeKey` is a path, so an area needs a nested write rather than a
       * top-level one — `{ ...rest, ["areas.main"]: tree }` would create a
       * literal key with a dot in it, which reads back as no area at all and
       * would look like the editor's work had simply vanished.
       */
      payload: () => {
        const { doc, tree } = get();
        const area = areaNameOf(doc.treeKey);
        const payload =
          area === null ? { ...doc.rest, [doc.treeKey]: tree } : withArea(doc.rest, area, tree);
        return stampBuilderPayload(payload);
      },

      markSaving: () => set({ save: { kind: "saving" } }),

      /**
       * `sentTree` and `sentRest` are the exact values handed to the server, not
       * the current ones. An edit made while the request was in flight must
       * leave the document dirty, or that edit is silently dropped from the next
       * save.
       *
       * `sentRest` is the areas half of that rule. Every operation that touches
       * another area — a switch, an add, a rename, a removal — replaces the
       * `rest` *reference*, so comparing references is enough to tell whether
       * the save that just landed actually carried them. Without it, switching
       * away and back mid-flight would clear `dirtyElsewhere` on a save that
       * predated the other area's edits.
       */
      markSaved: (sentTree, sentRest) =>
        set((state) => {
          const stale = state.tree !== sentTree || state.doc.rest !== sentRest;
          return {
            savedTree: sentTree,
            dirty: stale,
            dirtyElsewhere: stale ? state.dirtyElsewhere : false,
            save: stale ? { kind: "dirty" } : { kind: "saved", at: Date.now() },
          };
        }),

      markSaveError: (message) => set({ save: { kind: "error", message } }),

      setServerIssues: (issues) => set({ serverIssues: issues }),

      setDoc: (patch) => set((state) => ({ doc: { ...state.doc, ...patch } })),

      replaceTree: (tree, doc) =>
        set((state) => ({
          tree,
          savedTree: tree,
          dirty: false,
          // A rollback replaces the whole draft, so nothing is outstanding
          // anywhere — including in an area this store is not showing.
          dirtyElsewhere: false,
          past: [],
          future: [],
          historyTag: null,
          issues: validateTree(tree).issues,
          areaIssues: countAreaIssues(doc ? { ...state.doc, ...doc } : state.doc, tree),
          serverIssues: [],
          ...selectionForTree(tree, state.selectedKeys, state.selectedKey),
          save: { kind: "idle" },
          doc: doc ? { ...state.doc, ...doc } : state.doc,
        })),
    };
  });
}
