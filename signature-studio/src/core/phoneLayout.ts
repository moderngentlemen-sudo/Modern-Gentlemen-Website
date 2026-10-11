/**
 * The phone layout: a copy of the signature's block tree that phone-view
 * edits change, so desktop is never touched. It starts as an exact copy
 * (same block and column ids) the first time something is changed on the
 * phone, and from then on it follows desktop wherever it hasn't been changed
 * on the phone:
 *
 *  - a field edited on desktop flows to the phone copy unless the phone copy
 *    had already changed that field (a three-way merge per field, and per
 *    style setting);
 *  - a block added on desktop is added to the phone copy next to the same
 *    neighbour; a block deleted on desktop is deleted from it;
 *  - moving blocks on desktop doesn't reorder the phone copy, and anything
 *    added, removed or moved on the phone stays phone-only.
 *
 * Pure: no store, no DOM.
 */
import type { Block, Column } from "./types";

type Rec = Record<string, unknown>;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

/** Every block and column in a tree, by id, with where it sits. */
function index(root: Column) {
  const blocks = new Map<string, { block: Block; parent: Column; index: number }>();
  const columns = new Map<string, Column>([[root.id, root]]);
  const visit = (col: Column) =>
    col.blocks.forEach((block, i) => {
      blocks.set(block.id, { block, parent: col, index: i });
      if (block.type === "row")
        for (const c of block.columns) {
          columns.set(c.id, c);
          visit(c);
        }
    });
  visit(root);
  return { blocks, columns };
}

/** Copy into `phone` each field desktop changed (before → after) that the phone copy still has as it was. */
function mergeFields(before: Rec, after: Rec, phone: Rec, skip: string[]) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (skip.includes(key) || same(before[key], after[key])) continue;
    if (key === "style" || key === "box") {
      const b = (before[key] ?? {}) as Rec;
      const a = (after[key] ?? {}) as Rec;
      const p = { ...((phone[key] ?? {}) as Rec) };
      mergeFields(b, a, p, []);
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
      phone[key] = Object.keys(p).length ? p : undefined;
      if (phone[key] === undefined) delete phone[key];
      continue;
    }
    if (!same(phone[key], before[key])) continue;
    if (after[key] === undefined) delete phone[key];
    else phone[key] = clone(after[key]);
  }
}

/**
 * Bring a desktop edit (`before` → `after`) into the phone copy. Returns a
 * new phone tree; the inputs are not changed.
 */
export function syncPhone(before: Column, after: Column, phone0: Column): Column {
  const phone = structuredClone(phone0);
  const b = index(before);
  const a = index(after);
  const p = index(phone);

  // Deleted on desktop: delete on the phone too.
  for (const [id] of b.blocks)
    if (!a.blocks.has(id)) {
      const hit = p.blocks.get(id);
      if (hit) {
        const i = hit.parent.blocks.indexOf(hit.block);
        if (i >= 0) hit.parent.blocks.splice(i, 1);
      }
    }

  // Changed on desktop: follow, field by field, unless the phone changed that field.
  for (const [id, now] of a.blocks) {
    const was = b.blocks.get(id);
    const ph = p.blocks.get(id);
    if (!was || !ph) continue;
    mergeFields(was.block as unknown as Rec, now.block as unknown as Rec, ph.block as unknown as Rec, ["id", "type", "columns"]);
    // Columns of a row: their own settings follow the same way.
    if (now.block.type === "row" && was.block.type === "row" && ph.block.type === "row") {
      const phRow = ph.block;
      for (const col of now.block.columns) {
        const wasCol = was.block.columns.find((c) => c.id === col.id);
        const phCol = phRow.columns.find((c) => c.id === col.id);
        if (wasCol && phCol) mergeFields(wasCol as unknown as Rec, col as unknown as Rec, phCol as unknown as Rec, ["id", "blocks"]);
      }
      // A column added on desktop (and not already on the phone) is added there too.
      for (const col of now.block.columns)
        if (!was.block.columns.some((c) => c.id === col.id) && !phRow.columns.some((c) => c.id === col.id)) phRow.columns.push(clone(col));
    }
  }
  // The root column's own settings.
  mergeFields(before as unknown as Rec, after as unknown as Rec, phone as unknown as Rec, ["id", "blocks"]);

  // Added on desktop: add on the phone, after the same neighbour when it's there.
  const p2 = index(phone);
  for (const [id, hit] of a.blocks) {
    if (b.blocks.has(id) || p2.blocks.has(id)) continue;
    const target = p2.columns.get(hit.parent.id) ?? phone;
    const prev = hit.index > 0 ? hit.parent.blocks[hit.index - 1]?.id : undefined;
    const at = prev ? target.blocks.findIndex((x) => x.id === prev) + 1 : 0;
    const copy = clone(hit.block);
    target.blocks.splice(at > 0 ? at : prev ? target.blocks.length : 0, 0, copy);
    // Its own children are new too: index them so they aren't added twice.
    for (const [cid, ch] of index({ id: "_", blocks: [copy], gap: 0 }).blocks) p2.blocks.set(cid, ch);
  }
  return phone;
}

/** True when the phone copy says nothing desktop doesn't. */
export function samePhone(desktop: Column | undefined, phone: Column | undefined): boolean {
  return !phone || !desktop || same(desktop, phone);
}
