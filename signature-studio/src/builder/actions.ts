/** Builder commands. Every change goes through `edit`, so it is undoable and autosaved. */
import { blocksFromDoc, duplicateBlock, findBlock, findColumn, insertBlock, moveBlock, removeBlock, rowOfColumn } from "../core/blocks";
import type { Block, Column } from "../core/types";
import { edit, toast, ui, undo, useStudio } from "../store/editor";

export interface DropTarget {
  columnId: string;
  index: number;
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
  if (!d?.blocks) return null;
  const sel = useStudio.getState().selected;
  const hit = sel ? findBlock(d.blocks, sel) : null;
  if (hit) {
    // Selecting a row and adding drops into its first column.
    if (hit.block.type === "row" && hit.block.columns.length) return { columnId: hit.block.columns[0].id, index: hit.block.columns[0].blocks.length };
    return { columnId: hit.parent.id, index: hit.index + 1 };
  }
  return { columnId: d.blocks.id, index: d.blocks.blocks.length };
}

export function addBlock(b: Block, target: DropTarget | null = defaultTarget()) {
  if (!target) return;
  edit((d) => {
    if (d.blocks) insertBlock(d.blocks, b, target.columnId, target.index);
  });
  ui({ selected: b.id });
}

export function moveTo(id: string, target: DropTarget) {
  let ok = false;
  edit((d) => {
    if (d.blocks) ok = moveBlock(d.blocks, id, target.columnId, target.index);
  });
  if (ok) ui({ selected: id });
}

export function removeSelected() {
  const id = useStudio.getState().selected;
  if (!id) return;
  edit((d) => void (d.blocks && removeBlock(d.blocks, id)));
  ui({ selected: null });
  toast("Block deleted", "info", { label: "Undo", run: undo });
}

export function duplicateSelected() {
  const id = useStudio.getState().selected;
  if (!id) return;
  let copyId: string | null = null;
  edit((d) => {
    if (d.blocks) copyId = duplicateBlock(d.blocks, id)?.id ?? null;
  });
  if (copyId) ui({ selected: copyId });
}

/** Move the selection up/down within its column. */
export function nudgeSelected(by: -1 | 1) {
  const d = doc();
  const id = useStudio.getState().selected;
  if (!d?.blocks || !id) return;
  const hit = findBlock(d.blocks, id);
  if (!hit) return;
  const to = hit.index + (by > 0 ? 2 : -1);
  if (to < 0 || to > hit.parent.blocks.length) return;
  moveTo(id, { columnId: hit.parent.id, index: to });
}

/** Select the row that contains the selection. */
export function selectParent() {
  const d = doc();
  const id = useStudio.getState().selected;
  if (!d?.blocks || !id) return;
  const hit = findBlock(d.blocks, id);
  if (!hit) return;
  const row = rowOfColumn(d.blocks, hit.parent.id);
  if (row) ui({ selected: row.id });
}

/** Patch a block (merged shallowly). `key` coalesces rapid edits into one undo step. */
export function updateBlock(id: string, patch: Partial<Block> | ((b: Block) => void), key?: string) {
  edit(
    (d) => {
      const hit = d.blocks ? findBlock(d.blocks, id) : null;
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
      const c = d.blocks ? findColumn(d.blocks, id) : null;
      if (!c) return;
      if (typeof patch === "function") patch(c);
      else Object.assign(c, patch);
    },
    key ? `col.${id}.${key}` : undefined,
  );
}
