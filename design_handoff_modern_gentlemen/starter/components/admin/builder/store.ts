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
import type { BlockNode, BlockTree, BlockVisibility } from "@/lib/blocks/types";
import type { DocumentStatus, DocumentType } from "@/lib/domain/documents";

import { moveIndex } from "./dnd";
import { insertAfter, insertAt, moveByKey, moveInto, removeByKey } from "./tree";
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
  /** Which key in the payload holds the tree — "sections" for pages/articles. */
  treeKey: string;
  /** Everything in draft_data that is not the tree (seo, and so on). */
  rest: Record<string, unknown>;
}

export interface BuilderState {
  doc: BuilderDocument;
  tree: BlockTree;
  /** The last tree the server acknowledged. Dirtiness is a reference comparison. */
  savedTree: BlockTree;
  dirty: boolean;
  selectedKey: string | null;
  hoveredKey: string | null;
  device: "desktop" | "tablet" | "mobile";
  /** Local validation, recomputed on every structural or field change. */
  issues: BlockIssue[];
  /** Issues returned by a failed publish. Cleared when the editor edits again. */
  serverIssues: BlockIssue[];
  past: BlockTree[];
  future: BlockTree[];
  historyTag: string | null;
  historyAt: number;
  save: SaveStatus;
}

export interface BuilderActions {
  select: (key: string | null) => void;
  hover: (key: string | null) => void;
  setDevice: (device: BuilderState["device"]) => void;

  /**
   * `parentKey` names the container to insert into; the root when omitted.
   * Kept as a third positional argument rather than an options object so every
   * existing call site — and the whole click-to-insert path — is untouched.
   */
  insert: (type: string, at?: number, parentKey?: string | null) => void;
  duplicate: (key: string) => void;
  remove: (key: string) => void;
  move: (activeKey: string, overKey: string) => void;
  /** The drop-into-a-gap case: a position rather than another block. */
  moveTo: (activeKey: string, parentKey: string | null, index: number) => void;

  setSetting: (key: string, path: (string | number)[], value: unknown) => void;
  unsetSetting: (key: string, path: (string | number)[]) => void;
  listAdd: (key: string, path: (string | number)[], item: unknown) => void;
  listRemove: (key: string, path: (string | number)[], index: number) => void;
  listMove: (key: string, path: (string | number)[], from: number, to: number) => void;

  setVisibility: (key: string, patch: Partial<BlockVisibility>) => void;
  setLocked: (key: string, locked: boolean) => void;

  undo: () => void;
  redo: () => void;

  payload: () => Record<string, unknown>;
  markSaving: () => void;
  markSaved: (sentTree: BlockTree) => void;
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

      set({
        tree: next,
        past,
        future: [],
        historyTag: tag,
        historyAt: now,
        dirty: next !== state.savedTree,
        issues: validateTree(next).issues,
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
      selectedKey: null,
      hoveredKey: null,
      device: "desktop",
      issues: validateTree(init.tree).issues,
      serverIssues: [],
      past: [],
      future: [],
      historyTag: null,
      historyAt: 0,
      save: { kind: "idle" },

      select: (key) => set({ selectedKey: key }),
      hover: (key) => set({ hoveredKey: key }),
      setDevice: (device) => set({ device }),

      insert: (type, at, parentKey = null) => {
        const node = newBlockNode(type, keysOf(get().tree));
        replaceWith(insertAt(get().tree, node, parentKey, at));
        set({ selectedKey: node._key });
      },

      duplicate: (key) => {
        const state = get();
        // `findBlock` rather than `tree.find`: a nested block is duplicable
        // too, and its copy belongs beside it rather than at the root.
        const source = findBlock(state.tree, key);
        if (!source) return;

        const copy = cloneWithNewKeys(source, keysOf(state.tree));
        replaceWith(insertAfter(state.tree, key, copy));
        set({ selectedKey: copy._key });
      },

      remove: (key) => {
        replaceWith(removeByKey(get().tree, key));
        // A panel pointed at a block that no longer exists renders nothing and
        // reads as a bug, so drop the selection with the block.
        if (get().selectedKey === key) set({ selectedKey: null });
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

      // Deliberately not routed through `editSettings`: locking a block must
      // work on a block that is already locked, or it could never be unlocked.
      setLocked: (key, locked) =>
        commit(null, (draft) => {
          const node = findDraft(draft, key);
          if (node) node.locked = locked;
        }),

      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous) return;

        set({
          tree: previous,
          past: state.past.slice(0, -1),
          future: [...state.future, state.tree],
          dirty: previous !== state.savedTree,
          issues: validateTree(previous).issues,
          serverIssues: [],
          historyTag: null,
          selectedKey: findBlock(previous, state.selectedKey ?? "") ? state.selectedKey : null,
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
          dirty: next !== state.savedTree,
          issues: validateTree(next).issues,
          serverIssues: [],
          historyTag: null,
          selectedKey: findBlock(next, state.selectedKey ?? "") ? state.selectedKey : null,
          save: { kind: "dirty" },
        });
      },

      payload: () => {
        const { doc, tree } = get();
        return { ...doc.rest, [doc.treeKey]: tree };
      },

      markSaving: () => set({ save: { kind: "saving" } }),

      /**
       * `sentTree` is the exact tree handed to the server, not the current one.
       * An edit made while the request was in flight must leave the document
       * dirty, or that edit is silently dropped from the next save.
       */
      markSaved: (sentTree) =>
        set((state) => ({
          savedTree: sentTree,
          dirty: state.tree !== sentTree,
          save: state.tree !== sentTree ? { kind: "dirty" } : { kind: "saved", at: Date.now() },
        })),

      markSaveError: (message) => set({ save: { kind: "error", message } }),

      setServerIssues: (issues) => set({ serverIssues: issues }),

      setDoc: (patch) => set((state) => ({ doc: { ...state.doc, ...patch } })),

      replaceTree: (tree, doc) =>
        set((state) => ({
          tree,
          savedTree: tree,
          dirty: false,
          past: [],
          future: [],
          historyTag: null,
          issues: validateTree(tree).issues,
          serverIssues: [],
          selectedKey: findBlock(tree, state.selectedKey ?? "") ? state.selectedKey : null,
          save: { kind: "idle" },
          doc: doc ? { ...state.doc, ...doc } : state.doc,
        })),
    };
  });
}
