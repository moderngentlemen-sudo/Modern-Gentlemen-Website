/** Builder commands. Every change goes through `edit`, so it is undoable and autosaved. */
import {
  blocksFromDoc,
  cloneBlock,
  col,
  duplicateBlock,
  findBlock,
  findColumn,
  insertBlock,
  moveBeside,
  isWithin,
  moveBlock,
  panel,
  placeBeside,
  removeBlock,
  rowOf,
  rowOfColumn,
  walk,
} from "../core/blocks";
import type { Block, Column } from "../core/types";
import { edit, toast, ui, undo, useStudio, tree } from "../store/editor";

export interface DropTarget {
  columnId: string;
  index: number;
  /** Drop on a block's left/right edge: place side by side in a row. */
  beside?: { id: string; side: "left" | "right" };
}

const doc = () => useStudio.getState().doc;

/** Switch the open signature to the builder, converting its template the first time. */
export function enterBuilder() {
  edit((d) => {
    if (!d.blocks) d.blocks = blocksFromDoc(d);
    d.mode = "builder";
  });
  ui({ tab: "blocks", selected: null });
}

export function enterQuick() {
  edit((d) => void (d.mode = "quick"));
  ui({ tab: "details", selected: null });
}

/** Rebuild the layout from the current template (undoable). */
export function resetLayout() {
  edit((d) => void (d.blocks = blocksFromDoc(d)));
  ui({ selected: null });
  toast("Layout rebuilt from the template", "success", { label: "Undo", run: undo });
}

/** Where a new block goes when added with a click: after the selection, else at the end. */
export function defaultTarget(): DropTarget | null {
  const d = doc();
  const root = d ? tree(d) : undefined;
  if (!root) return null;
  const sel = useStudio.getState().selected;
  const hit = sel ? findBlock(root, sel) : null;
  if (hit) {
    // A selected row with an empty column gets filled; otherwise the new block goes after it.
    const empty = hit.block.type === "row" ? hit.block.columns.find((c) => !c.blocks.length) : undefined;
    if (empty) return { columnId: empty.id, index: 0 };
    return { columnId: hit.parent.id, index: hit.index + 1 };
  }
  return { columnId: root.id, index: root.blocks.length };
}

export function addBlock(b: Block, target: DropTarget | null = defaultTarget()) {
  if (!target) return;
  edit((d) => {
    const root = tree(d);
    if (!root) return;
    if (!(target.beside && placeBeside(root, b, target.beside.id, target.beside.side))) insertBlock(root, b, target.columnId, target.index);
  });
  ui({ selected: b.id, multi: [] });
}

export function moveTo(id: string, target: DropTarget) {
  let ok = false;
  edit((d) => {
    const root = tree(d);
    if (!root) return;
    ok = target.beside ? moveBeside(root, id, target.beside.id, target.beside.side) : moveBlock(root, id, target.columnId, target.index);
  });
  if (ok) ui({ selected: id, multi: [] });
}

/** Every selected block id (one or many). */
export function selectedIds(): string[] {
  const st = useStudio.getState();
  return st.multi.length ? st.multi : st.selected ? [st.selected] : [];
}

/** Selected ids in document order, leaving out any inside another selected block. */
function topSelected(root: Column): string[] {
  const ids = selectedIds();
  const order = [...walk(root)].map((w) => w.block.id);
  return ids
    .filter((id) => !ids.some((other) => other !== id && isWithin(root, other, id)))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .filter((id) => order.includes(id));
}

/** Shift/⌘-click: add a block to the selection, or take it out. */
export function toggleInSelection(id: string) {
  const cur = selectedIds();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (next.length >= 2) ui({ selected: next[next.length - 1], multi: next });
  else ui({ selected: next[0] ?? null });
}

export function removeSelected() {
  const d = doc();
  const top = d ? tree(d) : undefined;
  if (!top) return;
  const ids = topSelected(top);
  if (!ids.length) return;
  edit((x) => void (tree(x) && ids.forEach((id) => removeBlock(tree(x)!, id))));
  ui({ selected: null });
  toast(ids.length > 1 ? `${ids.length} blocks deleted` : "Block deleted", "info", { label: "Undo", run: undo });
}

export function duplicateSelected() {
  const d = doc();
  const top = d ? tree(d) : undefined;
  if (!top) return;
  const ids = topSelected(top);
  const copies: string[] = [];
  edit((x) => {
    const root = tree(x);
    if (root) for (const id of ids) copies.push(duplicateBlock(root, id)?.id ?? "");
  });
  const ok = copies.filter(Boolean);
  if (ok.length >= 2) ui({ selected: ok[ok.length - 1], multi: ok });
  else if (ok.length) ui({ selected: ok[0] });
}

/** Apply the same change to every selected block, as one undo step. */
export function updateSelected(fn: (b: Block) => void, key?: string) {
  const ids = selectedIds();
  edit(
    (d) => {
      if (!tree(d)) return;
      for (const id of ids) {
        const hit = findBlock(tree(d), id);
        if (hit) fn(hit.block as Block);
      }
    },
    key ? `multi.${ids.join(",")}.${key}` : undefined,
  );
}

/** Put the selected blocks in one panel, or side by side in columns (up to 4). */
export function wrapSelected(kind: "panel" | "columns") {
  const d = doc();
  const top = d ? tree(d) : undefined;
  if (!top) return;
  const ids = topSelected(top);
  if (ids.length < (kind === "columns" ? 2 : 1)) return;
  if (kind === "columns" && ids.length > 4) return toast("Up to 4 blocks can sit side by side", "info");
  let rowId = "";
  edit((x) => {
    const root = tree(x);
    if (!root) return;
    const items = ids.map((id) => findBlock(root, id)?.block).filter((b): b is Block => !!b);
    ids.slice(1).forEach((id) => removeBlock(root, id));
    const first = findBlock(root, ids[0]);
    if (!first) return;
    const row =
      kind === "panel"
        ? panel(items, { background: "#f6f6f6", padding: 14, radius: 8 }, 6)
        : rowOf(
            items.map((b) => col([b])),
            { valign: "middle" },
          );
    rowId = row.id;
    first.parent.blocks.splice(first.index, 1, row);
  });
  if (rowId) ui({ selected: rowId });
}

/** Move the selection up/down within its column. */
export function nudgeSelected(by: -1 | 1) {
  const d = doc();
  const id = useStudio.getState().selected;
  const root = d ? tree(d) : undefined;
  if (!root || !id) return;
  const hit = findBlock(root, id);
  if (!hit) return;
  const to = hit.index + (by > 0 ? 2 : -1);
  if (to < 0 || to > hit.parent.blocks.length) return;
  moveTo(id, { columnId: hit.parent.id, index: to });
}

/** Select the row that contains the selection. */
export function selectParent() {
  const d = doc();
  const id = useStudio.getState().selected;
  const root = d ? tree(d) : undefined;
  if (!root || !id) return;
  const hit = findBlock(root, id);
  if (!hit) return;
  const row = rowOfColumn(root, hit.parent.id);
  if (row) ui({ selected: row.id });
}

/** Patch a block (merged shallowly). `key` coalesces rapid edits into one undo step. */
export function updateBlock(id: string, patch: Partial<Block> | ((b: Block) => void), key?: string) {
  edit(
    (d) => {
      const hit = tree(d) ? findBlock(tree(d), id) : null;
      if (!hit) return;
      if (typeof patch === "function") patch(hit.block as Block);
      else Object.assign(hit.block, patch);
    },
    key ? `block.${id}.${key}` : undefined,
  );
}

export function updateColumn(id: string, patch: Partial<Column> | ((c: Column) => void), key?: string) {
  edit(
    (d) => {
      const c = tree(d) ? findColumn(tree(d), id) : null;
      if (!c) return;
      if (typeof patch === "function") patch(c);
      else Object.assign(c, patch);
    },
    key ? `col.${id}.${key}` : undefined,
  );
}

/** Move any block up/down within its column (layers panel). */
export function nudgeBlock(id: string, by: -1 | 1) {
  ui({ selected: id });
  nudgeSelected(by);
}

/** Hide a block without deleting it (or show it again). */
export function toggleHidden(id: string) {
  updateBlock(id, (b) => void (b.visibility = b.visibility === "hidden" ? undefined : "hidden"));
}

let clipboard: Block | null = null;

/** Copy the selected block (⌘C) — kept in memory for ⌘V, across signatures. */
export function copySelected(): boolean {
  const d = doc();
  const id = useStudio.getState().selected;
  const hit = d && id ? findBlock(tree(d), id) : null;
  if (!hit) return false;
  clipboard = cloneBlock(hit.block);
  toast("Block copied — paste with ⌘V", "info");
  return true;
}

export function pasteBlock(): boolean {
  if (!clipboard) return false;
  addBlock(cloneBlock(clipboard));
  return true;
}
