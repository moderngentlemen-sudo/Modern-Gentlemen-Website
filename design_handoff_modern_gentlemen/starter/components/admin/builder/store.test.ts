/**
 * The builder store.
 *
 * Reordering is asserted here rather than through a simulated drag: dnd-kit
 * measures the DOM, jsdom has no layout engine, and the `ResizeObserver` stub in
 * the unit setup is inert. The canvas reduces a drag to two keys and calls
 * `move`, so this is the behaviour that actually matters.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { manifestFor } from "@/lib/blocks/manifests";
import { validateTree } from "@/lib/blocks/validate";
import type { BlockTree } from "@/lib/blocks/types";

import { COALESCE_MS, HISTORY_LIMIT, createBuilderStore, type BuilderStore } from "./store";
import { cloneWithNewKeys, keysOf, newBlockNode, newKey } from "./node";
import { moveByKey } from "./tree";

function makeStore(tree: BlockTree = []): BuilderStore {
  return createBuilderStore({
    doc: {
      type: "page",
      id: "page-1",
      title: "Homepage",
      slug: "home",
      status: "draft",
      version: 1,
      treeKey: "sections",
      rest: { seo: { title: "Home" } },
    },
    tree,
  });
}

describe("insertMany — inserting a pattern as a copy", () => {
  /** Two blocks, as a saved pattern's payload would hold them. */
  function patternBlocks(): BlockTree {
    const a = newBlockNode("latestGrid", new Set());
    const b = newBlockNode("latestGrid", new Set([a._key]));
    return [a, b];
  }

  it("inserts every block in the group, in order", () => {
    const store = makeStore();
    store.getState().insertMany(patternBlocks());

    expect(store.getState().tree).toHaveLength(2);
    expect(store.getState().tree.every((node) => node._type === "latestGrid")).toBe(true);
  });

  it("gives every inserted block a key that is new to this tree", () => {
    const existing = newBlockNode("latestGrid", new Set());
    const store = makeStore([existing]);

    const blocks = patternBlocks();
    store.getState().insertMany(blocks);

    // `keysOf` returns a Set, so it cannot itself reveal a duplicate — the
    // tree is walked directly for that.
    const keys = [...keysOf(store.getState().tree)];
    const walked = store.getState().tree.map((node) => node._key);
    expect(new Set(walked).size, "no duplicate keys among the roots").toBe(walked.length);
    expect(keys).toHaveLength(3);
    // The pattern's own stored keys must not survive the copy, or inserting the
    // same pattern twice would collide with itself.
    for (const source of blocks) {
      expect(keys).not.toContain(source._key);
    }
  });

  it("does not let two blocks of one pattern draw the same key", () => {
    // The regression this guards: cloning each node against `keysOf(tree)`
    // alone, rather than threading the taken set through the batch, lets the
    // second clone reuse the first clone's fresh key. Both blocks are identical
    // here, so nothing but the keys distinguishes them.
    const store = makeStore();
    store.getState().insertMany(patternBlocks());

    const [first, second] = store.getState().tree;
    expect(first._key).not.toBe(second._key);
  });

  it("inserts at a position, keeping the group's order", () => {
    const first = newBlockNode("latestGrid", new Set());
    const last = newBlockNode("latestGrid", new Set([first._key]));
    const store = makeStore([first, last]);

    store.getState().insertMany(patternBlocks(), 1);

    const keys = store.getState().tree.map((node) => node._key);
    expect(keys[0]).toBe(first._key);
    expect(keys[3]).toBe(last._key);
    expect(keys).toHaveLength(4);
  });

  it("is one undo, not one per block", () => {
    const store = makeStore();
    store.getState().insertMany(patternBlocks());
    expect(store.getState().tree).toHaveLength(2);

    store.getState().undo();
    expect(store.getState().tree, "undoing an insert removes the whole pattern").toHaveLength(0);
  });

  it("does nothing when handed an empty pattern", () => {
    const store = makeStore();
    store.getState().insertMany([]);

    expect(store.getState().tree).toHaveLength(0);
    expect(store.getState().past, "an empty insert is not an undo entry").toHaveLength(0);
  });
});

describe("insert", () => {
  it("carries the manifest's insert defaults into settings", () => {
    const store = makeStore();
    store.getState().insert("latestGrid");

    const [node] = store.getState().tree;
    expect(node._type).toBe("latestGrid");
    expect(node.settings).toEqual(manifestFor("latestGrid")!.insertDefaults);
  });

  it("deep-copies them, so two inserted blocks never share nested objects", () => {
    // Object.freeze in defineBlock is SHALLOW: insertDefaults.items[0] is not
    // frozen and is the same object every time. A shallow spread would have
    // editing one block silently edit the other.
    const store = makeStore();
    store.getState().insert("latestGrid");
    store.getState().insert("latestGrid");

    const [first, second] = store.getState().tree;
    const firstItems = (first.settings as { items?: unknown[] }).items;
    const secondItems = (second.settings as { items?: unknown[] }).items;

    expect(Array.isArray(firstItems)).toBe(true);
    expect(firstItems![0]).not.toBe(secondItems![0]);
  });

  it("does not mutate the frozen manifest when an inserted block is edited", () => {
    const before = JSON.stringify(manifestFor("latestGrid")!.insertDefaults);

    const store = makeStore();
    store.getState().insert("latestGrid");
    const key = store.getState().tree[0]._key;
    store.getState().setSetting(key, ["items", 0, "title"], "Edited");

    expect(JSON.stringify(manifestFor("latestGrid")!.insertDefaults)).toBe(before);
  });

  it("selects the block it just inserted", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    expect(store.getState().selectedKey).toBe(store.getState().tree[0]._key);
  });

  it("inserts at an index when given one", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");
    store.getState().insert("newsletter", 1);

    expect(store.getState().tree.map((n) => n._type)).toEqual([
      "pullQuote",
      "newsletter",
      "masthead",
    ]);
  });
});

describe("keys", () => {
  it("mints unique keys across many inserts", () => {
    const store = makeStore();
    for (let i = 0; i < 200; i++) store.getState().insert("pullQuote");

    const keys = store.getState().tree.map((n) => n._key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("produces a tree with no duplicate-key issues", () => {
    const store = makeStore();
    for (let i = 0; i < 50; i++) store.getState().insert("masthead");

    const messages = validateTree(store.getState().tree).issues.map((i) => i.message);
    expect(messages.filter((m) => /duplicate/i.test(m))).toEqual([]);
  });

  it("newKey does not repeat over ten thousand draws", () => {
    const keys = new Set(Array.from({ length: 10_000 }, () => newKey()));
    expect(keys.size).toBe(10_000);
  });
});

describe("duplicate", () => {
  it("inserts the copy directly after the original with a fresh key", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    const original = store.getState().tree[0]._key;

    store.getState().duplicate(original);

    const tree = store.getState().tree;
    expect(tree).toHaveLength(2);
    expect(tree[0]._key).toBe(original);
    expect(tree[1]._key).not.toBe(original);
    expect(tree[1]._type).toBe("pullQuote");
  });

  it("re-keys every descendant, not just the root", () => {
    const nested = {
      _key: "a",
      _type: "pullQuote",
      children: [
        { _key: "b", _type: "masthead" },
        { _key: "c", _type: "masthead", children: [{ _key: "d", _type: "pullQuote" }] },
      ],
    };

    const copy = cloneWithNewKeys(nested, keysOf([nested]));
    const copiedKeys = keysOf([copy]);

    for (const original of ["a", "b", "c", "d"]) expect(copiedKeys.has(original)).toBe(false);
    expect(copiedKeys.size).toBe(4);
  });

  it("does not share nested settings with the original", () => {
    const store = makeStore();
    store.getState().insert("latestGrid");
    const original = store.getState().tree[0]._key;
    store.getState().duplicate(original);

    const copyKey = store.getState().tree[1]._key;
    store.getState().setSetting(copyKey, ["items", 0, "title"], "Changed on the copy");

    const originalItems = (store.getState().tree[0].settings as { items: { title: string }[] })
      .items;
    expect(originalItems[0].title).not.toBe("Changed on the copy");
  });
});

describe("remove and move", () => {
  it("drops the selection along with the selected block", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    const key = store.getState().tree[0]._key;

    expect(store.getState().selectedKey).toBe(key);
    store.getState().remove(key);
    expect(store.getState().selectedKey).toBeNull();
  });

  it("keeps a selection that survived the removal", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    const first = store.getState().tree[0]._key;
    store.getState().insert("masthead");
    const second = store.getState().tree[1]._key;

    store.getState().select(first);
    store.getState().remove(second);
    expect(store.getState().selectedKey).toBe(first);
  });

  it("reorders by key", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");
    store.getState().insert("newsletter");

    const [a, b, c] = store.getState().tree.map((n) => n._key);
    store.getState().move(c, a);

    expect(store.getState().tree.map((n) => n._key)).toEqual([c, a, b]);
  });

  it("moveByKey leaves the tree alone for unknown keys", () => {
    const tree: BlockTree = [{ _key: "a", _type: "pullQuote" }];
    expect(moveByKey(tree, "a", "nope")).toBe(tree);
    expect(moveByKey(tree, "a", "a")).toBe(tree);
  });
});

describe("containers", () => {
  /**
   * A store holding one empty container, plus its key.
   *
   * A **`column`**, not a `columns` row. These cases are about nesting in
   * general — insert, edit, lock, duplicate, remove, move, undo — and a column
   * is the plain unrestricted container: any child type, no seeded children, no
   * `min`. A row is the specialised one (`allow: ["column"]`, two columns
   * seeded), and it gets its own cases below rather than distorting these.
   */
  function withContainer() {
    const store = makeStore();
    store.getState().insert("column");
    return { store, container: store.getState().tree[0]._key };
  }

  it("inserts into a container rather than the root", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);

    expect(store.getState().tree).toHaveLength(1);
    expect(store.getState().tree[0].children!.map((n) => n._type)).toEqual(["pullQuote"]);
  });

  it("selects the block it inserted, wherever it went", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    expect(store.getState().selectedKey).toBe(store.getState().tree[0].children![0]._key);
  });

  it("edits a nested block's settings", () => {
    // The whole point of `findDraft`: `draft.find` would never reach this node,
    // and the edit would silently do nothing.
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;

    store.getState().setSetting(nested, ["quote"], "From inside a column");

    const settings = store.getState().tree[0].children![0].settings as { quote: string };
    expect(settings.quote).toBe("From inside a column");
  });

  it("locks and hides a nested block", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;

    store.getState().setLocked(nested, true);
    store.getState().setVisibility(nested, { hidden: true });

    const node = store.getState().tree[0].children![0];
    expect(node.locked).toBe(true);
    expect(node.visibility?.hidden).toBe(true);
  });

  it("refuses a field edit on a locked nested block", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;
    store.getState().setLocked(nested, true);

    const before = store.getState().tree;
    store.getState().setSetting(nested, ["quote"], "Should not land");
    expect(store.getState().tree).toBe(before);
  });

  it("duplicates a nested block beside itself, not at the root", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;

    store.getState().duplicate(nested);

    expect(store.getState().tree).toHaveLength(1);
    expect(store.getState().tree[0].children).toHaveLength(2);
  });

  it("removes a nested block, and its container with everything in it", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    store.getState().insert("masthead", 1, container);
    const nested = store.getState().tree[0].children![0]._key;

    store.getState().remove(nested);
    expect(store.getState().tree[0].children).toHaveLength(1);

    store.getState().remove(container);
    expect(store.getState().tree).toEqual([]);
  });

  it("moves a root block into a container and back out", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    store.getState().insert("newsletter");
    const outside = store.getState().tree[1]._key;
    const inside = store.getState().tree[0].children![0]._key;

    store.getState().move(outside, inside);
    expect(store.getState().tree).toHaveLength(1);
    expect(store.getState().tree[0].children).toHaveLength(2);

    store.getState().moveTo(outside, null, 0);
    expect(store.getState().tree.map((n) => n._key)).toEqual([outside, container]);
  });

  it("refuses to move a container into itself, and records no history for it", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;

    const before = store.getState().tree;
    const history = store.getState().past.length;

    store.getState().move(container, nested);

    expect(store.getState().tree).toBe(before);
    expect(store.getState().past).toHaveLength(history);
  });

  it("undoes a nested edit", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    store.getState().undo();

    expect(store.getState().tree[0].children ?? []).toHaveLength(0);
  });

  it("keeps a nested selection through undo, and drops one that did not survive", () => {
    const { store, container } = withContainer();
    store.getState().insert("pullQuote", 0, container);
    const nested = store.getState().tree[0].children![0]._key;

    store.getState().setSetting(nested, ["quote"], "x");
    store.getState().undo();
    // `findBlock` recurses, so a nested selection survives an undo that keeps
    // the block — which is what makes the panel stay put.
    expect(store.getState().selectedKey).toBe(nested);

    store.getState().undo();
    expect(store.getState().selectedKey).toBeNull();
  });

  it("does not report an empty column as a publish issue", () => {
    const { store } = withContainer();
    // A column's slot declares no `min`, deliberately: an empty cell is how a
    // row offsets its content, and refusing to publish one would forbid a thing
    // the grid exists to express.
    expect(store.getState().issues.some((i) => i.path === "children")).toBe(false);
  });
});

describe("a columns row", () => {
  function withRow() {
    const store = makeStore();
    store.getState().insert("columns");
    return { store, row: store.getState().tree[0] };
  }

  it("arrives holding two columns", () => {
    // `insertChildren` on the manifest. A row with no columns has nowhere to
    // drop anything, which is the state this whole change exists to remove.
    const { row } = withRow();
    expect(row.children?.map((n) => n._type)).toEqual(["column", "column"]);
  });

  it("mints a distinct key for every seeded child", () => {
    // Two children built from one `existing` snapshot could collide, and a
    // duplicate key fails the tree's own validation.
    const { row } = withRow();
    const keys = [row._key, ...(row.children ?? []).map((n) => n._key)];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is publishable as it arrives, since it holds its minimum of one", () => {
    const { store } = withRow();
    expect(store.getState().issues.some((i) => i.path === "children")).toBe(false);
  });

  it("refuses a section as a direct child, and says which block", () => {
    // `allow: ["column"]` — the first manifest to use it. Reachable only by a
    // drop the canvas no longer offers, or by data from before this change.
    const { store, row } = withRow();
    store.getState().insert("pullQuote", 0, row._key);

    expect(
      store.getState().issues.some((i) => i.message.includes('"pullQuote" is not allowed'))
    ).toBe(true);
  });
});

describe("settings", () => {
  let store: BuilderStore;
  let key: string;

  beforeEach(() => {
    store = makeStore();
    store.getState().insert("latestGrid");
    key = store.getState().tree[0]._key;
  });

  it("writes under settings, never as a top-level prop", () => {
    store.getState().setSetting(key, ["eyebrow"], "THE LATEST");

    const node = store.getState().tree[0];
    expect((node.settings as { eyebrow: string }).eyebrow).toBe("THE LATEST");
    expect(node.eyebrow).toBeUndefined();
  });

  it("writes nested paths, creating arrays for numeric segments", () => {
    store.getState().setSetting(key, ["items", 2, "title"], "Third");

    const items = (store.getState().tree[0].settings as { items: { title: string }[] }).items;
    expect(Array.isArray(items)).toBe(true);
    expect(items[2].title).toBe("Third");
  });

  it("unsets a key rather than writing an empty string", () => {
    store.getState().setSetting(key, ["eyebrow"], "X");
    store.getState().unsetSetting(key, ["eyebrow"]);
    expect("eyebrow" in (store.getState().tree[0].settings as object)).toBe(false);
  });

  it("adds, moves and removes list items", () => {
    store.getState().setSetting(key, ["items"], []);
    store.getState().listAdd(key, ["items"], { title: "One" });
    store.getState().listAdd(key, ["items"], { title: "Two" });
    store.getState().listMove(key, ["items"], 0, 1);

    let items = (store.getState().tree[0].settings as { items: { title: string }[] }).items;
    expect(items.map((i) => i.title)).toEqual(["Two", "One"]);

    store.getState().listRemove(key, ["items"], 0);
    items = (store.getState().tree[0].settings as { items: { title: string }[] }).items;
    expect(items.map((i) => i.title)).toEqual(["One"]);
  });

  it("refuses edits to a locked block", () => {
    store.getState().setSetting(key, ["eyebrow"], "Before");
    store.getState().setLocked(key, true);
    store.getState().setSetting(key, ["eyebrow"], "After");

    const settings = store.getState().tree[0].settings as { eyebrow: string };
    expect(settings.eyebrow).toBe("Before");
  });

  it("can still unlock a locked block", () => {
    store.getState().setLocked(key, true);
    store.getState().setLocked(key, false);
    expect(store.getState().tree[0].locked).toBe(false);
  });

  it("writes visibility, which nothing in the repo had written before", () => {
    store.getState().setVisibility(key, { hidden: true });
    store.getState().setVisibility(key, { devices: ["mobile"] });

    expect(store.getState().tree[0].visibility).toEqual({ hidden: true, devices: ["mobile"] });
  });
});

describe("undo and redo", () => {
  it("restores the exact previous tree", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    const afterFirst = store.getState().tree;

    store.getState().insert("masthead");
    expect(store.getState().tree).toHaveLength(2);

    store.getState().undo();
    expect(store.getState().tree).toBe(afterFirst);
  });

  it("redoes what it undid", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");
    const afterSecond = store.getState().tree;

    store.getState().undo();
    store.getState().redo();
    expect(store.getState().tree).toBe(afterSecond);
  });

  it("clears the redo stack once a new edit lands", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);

    store.getState().insert("newsletter");
    expect(store.getState().future).toHaveLength(0);
  });

  it("coalesces rapid edits to one field into a single undo entry", () => {
    const store = makeStore();
    store.getState().insert("latestGrid");
    const key = store.getState().tree[0]._key;
    const depthBefore = store.getState().past.length;

    store.getState().setSetting(key, ["eyebrow"], "T");
    store.getState().setSetting(key, ["eyebrow"], "TH");
    store.getState().setSetting(key, ["eyebrow"], "THE");

    expect(store.getState().past.length).toBe(depthBefore + 1);
  });

  it("starts a new undo entry for a different field", () => {
    const store = makeStore();
    store.getState().insert("latestGrid");
    const key = store.getState().tree[0]._key;
    const depthBefore = store.getState().past.length;

    store.getState().setSetting(key, ["eyebrow"], "A");
    store.getState().setSetting(key, ["heading"], "B");

    expect(store.getState().past.length).toBe(depthBefore + 2);
  });

  it("starts a new undo entry once the coalesce window has passed", () => {
    vi.useFakeTimers();
    try {
      const store = makeStore();
      store.getState().insert("latestGrid");
      const key = store.getState().tree[0]._key;
      const depthBefore = store.getState().past.length;

      store.getState().setSetting(key, ["eyebrow"], "A");
      vi.advanceTimersByTime(COALESCE_MS + 50);
      store.getState().setSetting(key, ["eyebrow"], "AB");

      expect(store.getState().past.length).toBe(depthBefore + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps history rather than growing without bound", () => {
    const store = makeStore();
    for (let i = 0; i < HISTORY_LIMIT + 25; i++) store.getState().insert("masthead");
    expect(store.getState().past.length).toBe(HISTORY_LIMIT);
  });

  it("drops a selection that undo removed from the tree", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");
    expect(store.getState().selectedKey).not.toBeNull();

    store.getState().undo(); // the second block, which is selected, disappears
    expect(store.getState().selectedKey).toBeNull();
  });
});

describe("save lifecycle", () => {
  it("is not dirty until something changes", () => {
    const store = makeStore([{ _key: "a", _type: "pullQuote" }]);
    expect(store.getState().dirty).toBe(false);

    store.getState().insert("masthead");
    expect(store.getState().dirty).toBe(true);
  });

  it("builds a payload of the tree under its own key plus the rest of the document", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");

    expect(store.getState().payload()).toEqual({
      seo: { title: "Home" },
      sections: store.getState().tree,
    });
  });

  it("clears dirty when the saved tree is the current one", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");

    const sent = store.getState().tree;
    const sentRest = store.getState().doc.rest;
    store.getState().markSaving();
    store.getState().markSaved(sent, sentRest);

    expect(store.getState().dirty).toBe(false);
    expect(store.getState().save.kind).toBe("saved");
  });

  it("stays dirty when an edit landed while the save was in flight", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");

    const sent = store.getState().tree;
    const sentRest = store.getState().doc.rest;
    store.getState().markSaving();
    store.getState().insert("masthead"); // the editor keeps typing
    store.getState().markSaved(sent, sentRest);

    expect(store.getState().dirty).toBe(true);
    expect(store.getState().save.kind).toBe("dirty");
  });

  it("setDoc patches status and version, which publishing has to apply itself", () => {
    // The store is seeded once and `router.refresh()` does not re-seed it — the
    // provider holds one store per document by design. Without this the publish
    // bar went on showing "draft" and the old version number after a publish
    // that had genuinely succeeded, until a full page reload.
    const store = makeStore();
    expect(store.getState().doc.status).toBe("draft");

    store.getState().setDoc({ status: "published", version: 4 });

    expect(store.getState().doc.status).toBe("published");
    expect(store.getState().doc.version).toBe(4);
    // Everything else about the document is left alone.
    expect(store.getState().doc.slug).toBe("home");
  });

  it("replaceTree resets history and dirtiness, as after a rollback", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    store.getState().insert("masthead");

    store.getState().replaceTree([{ _key: "restored", _type: "pullQuote" }], { version: 8 });

    const state = store.getState();
    expect(state.tree).toHaveLength(1);
    expect(state.dirty).toBe(false);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(state.doc.version).toBe(8);
  });
});

describe("validation", () => {
  it("recomputes local issues on every change", () => {
    const store = makeStore();
    store.getState().insert("latestGrid");
    const key = store.getState().tree[0]._key;

    store.getState().setSetting(key, ["notAFieldOnThisBlock"], "x");
    expect(store.getState().issues.some((i) => i.key === key)).toBe(true);
  });

  it("clears server issues once the editor edits again", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");
    const key = store.getState().tree[0]._key;

    store
      .getState()
      .setServerIssues([{ key, type: "pullQuote", path: "quote", message: "Required" }]);
    expect(store.getState().serverIssues).toHaveLength(1);

    store.getState().setSetting(key, ["quote"], "Something");
    expect(store.getState().serverIssues).toHaveLength(0);
  });
});

describe("newBlockNode", () => {
  it("avoids keys already present in the tree", () => {
    const existing = new Set(["k_aaa", "k_bbb"]);
    const node = newBlockNode("pullQuote", existing);
    expect(existing.has(node._key)).toBe(false);
  });

  it("gives an unknown type empty settings rather than throwing", () => {
    const node = newBlockNode("noSuchBlock");
    expect(node.settings).toEqual({});
  });
});

/**
 * Areas — a template's several block trees, one open at a time.
 *
 * The store holds exactly one tree, and `doc.rest` holds the rest of the
 * payload. For a template that means `rest` carries every area, including a
 * possibly stale copy of the open one. Nearly every assertion below is really
 * one question: after operation X, is any area's work only in a place nothing
 * will send?
 */
describe("areas", () => {
  function makeTemplate(
    areas: Record<string, BlockTree> = { header: [], main: [] },
    open = "main"
  ): BuilderStore {
    return createBuilderStore({
      doc: {
        type: "template",
        id: "template-1",
        title: "Editorial layout",
        slug: "editorial",
        status: "draft",
        version: 1,
        treeKey: `areas.${open}`,
        rest: { areas },
        areaNames: Object.keys(areas).sort(),
      },
      tree: areas[open] ?? [],
    });
  }

  it("writes the open area back into the payload at its nested path", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");

    const payload = store.getState().payload() as { areas: Record<string, BlockTree> };

    // The bug this forecloses: `{ ...rest, ["areas.main"]: tree }` produces a
    // literal dotted key, which reads back as no area at all.
    expect(Object.keys(payload)).toEqual(["areas"]);
    expect(payload.areas.main).toEqual(store.getState().tree);
    expect(payload.areas.header).toEqual([]);
  });

  it("keeps a one-tree document's payload exactly as it was", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");

    expect(store.getState().payload()).toEqual({
      seo: { title: "Home" },
      sections: store.getState().tree,
    });
  });

  it("banks the open area before opening another, so a switch cannot lose an edit", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");
    const edited = store.getState().tree;

    store.getState().setArea("header");

    expect(store.getState().doc.treeKey).toBe("areas.header");
    expect(store.getState().tree).toEqual([]);
    // The edit is still in the payload that would be sent.
    expect((store.getState().payload() as { areas: Record<string, BlockTree> }).areas.main).toEqual(
      edited
    );
  });

  it("carries dirtiness across a switch", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");
    store.getState().setArea("header");

    expect(store.getState().dirty).toBe(true);
    expect(store.getState().dirtyElsewhere).toBe(true);
  });

  /**
   * The hole `dirtyElsewhere` exists to close. Edit area A, switch to B, then
   * make and undo an edit in B: B is back at its loaded tree, so the reference
   * comparison says clean — while A's edit is still only in `rest`.
   */
  it("stays dirty when an undo returns the open area to its loaded state", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");
    store.getState().setArea("header");

    store.getState().insert("masthead");
    store.getState().undo();

    expect(store.getState().tree).toEqual([]);
    expect(store.getState().dirty).toBe(true);
  });

  it("does not carry dirtiness across a switch that followed no edit", () => {
    const store = makeTemplate();
    store.getState().setArea("header");

    expect(store.getState().dirty).toBe(false);
    expect(store.getState().dirtyElsewhere).toBe(false);
  });

  it("clears the undo stack on a switch, so undo cannot restore another area's blocks", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");
    expect(store.getState().past.length).toBeGreaterThan(0);

    store.getState().setArea("header");
    expect(store.getState().past).toEqual([]);
    expect(store.getState().future).toEqual([]);
  });

  it("drops the selection on a switch, so the panel cannot edit an unshown block", () => {
    const store = makeTemplate();
    store.getState().insert("pullQuote");
    expect(store.getState().selectedKey).not.toBeNull();

    store.getState().setArea("header");
    expect(store.getState().selectedKey).toBeNull();
  });

  it("ignores a switch to the open area or to one that does not exist", () => {
    const store = makeTemplate();
    const before = store.getState();

    store.getState().setArea("main");
    store.getState().setArea("nope");

    expect(store.getState().doc).toBe(before.doc);
    expect(store.getState().tree).toBe(before.tree);
  });

  describe("addArea", () => {
    it("adds an empty area, opens it, and leaves the document dirty", () => {
      const store = makeTemplate();
      expect(store.getState().addArea("footer")).toBeNull();

      expect(store.getState().doc.areaNames).toEqual(["footer", "header", "main"]);
      expect(store.getState().doc.treeKey).toBe("areas.footer");
      expect(store.getState().tree).toEqual([]);
      expect(store.getState().dirty).toBe(true);
    });

    it("banks the open area's edits first", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");
      const edited = store.getState().tree;

      store.getState().addArea("footer");

      expect(
        (store.getState().payload() as { areas: Record<string, BlockTree> }).areas.main
      ).toEqual(edited);
    });

    it("refuses a duplicate name and a name that is not slug-shaped", () => {
      const store = makeTemplate();
      expect(store.getState().addArea("main")).toMatch(/already an area/);
      expect(store.getState().addArea("Not A Slug")).toMatch(/lower-case/);
      expect(store.getState().doc.areaNames).toEqual(["header", "main"]);
    });
  });

  describe("renameArea", () => {
    it("moves the blocks and follows the open area", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");
      const edited = store.getState().tree;

      expect(store.getState().renameArea("main", "body")).toBeNull();

      expect(store.getState().doc.areaNames).toEqual(["body", "header"]);
      expect(store.getState().doc.treeKey).toBe("areas.body");
      // The renamed area keeps the *current* tree, not the one on disk — the
      // rename banks the open tree before moving it.
      expect(
        (store.getState().payload() as { areas: Record<string, BlockTree> }).areas.body
      ).toEqual(edited);
    });

    it("renames an area that is not open without disturbing the open one", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");
      const edited = store.getState().tree;

      expect(store.getState().renameArea("header", "top")).toBeNull();

      expect(store.getState().doc.treeKey).toBe("areas.main");
      expect(store.getState().tree).toBe(edited);
      expect(store.getState().doc.areaNames).toEqual(["main", "top"]);
    });

    it("refuses a rename onto an occupied name, which would destroy one of them", () => {
      const store = makeTemplate();
      expect(store.getState().renameArea("main", "header")).toMatch(/already an area/);
      expect(store.getState().doc.areaNames).toEqual(["header", "main"]);
    });
  });

  describe("removeArea", () => {
    it("removes an area and opens another when it was the open one", () => {
      const store = makeTemplate();
      expect(store.getState().removeArea("main")).toBeNull();

      expect(store.getState().doc.areaNames).toEqual(["header"]);
      expect(store.getState().doc.treeKey).toBe("areas.header");
      expect((store.getState().payload() as { areas: Record<string, BlockTree> }).areas).toEqual({
        header: [],
      });
    });

    it("leaves the open area alone when removing a different one", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");
      const edited = store.getState().tree;

      store.getState().removeArea("header");

      expect(store.getState().doc.treeKey).toBe("areas.main");
      expect(store.getState().tree).toBe(edited);
    });

    // A template with no areas has no tree the builder can open, so emptying it
    // would make it uneditable by the very screen that emptied it.
    it("refuses to remove the last area", () => {
      const store = makeTemplate({ main: [] }, "main");
      expect(store.getState().removeArea("main")).toMatch(/at least one area/);
      expect(store.getState().doc.areaNames).toEqual(["main"]);
    });
  });

  describe("areaIssues", () => {
    /**
     * Publish validates every area; the tray only ever sees the open one. Without
     * a per-area count the tray could say "no issues" while publish refused the
     * document over a block nobody was looking at.
     */
    it("counts every area at init, not only the open one", () => {
      const broken = [newBlockNode("pullQuote", new Set())];
      broken[0].settings = {}; // a pullQuote with no quote fails its manifest
      expect(validateTree(broken).issues.length).toBeGreaterThan(0);

      const store = makeTemplate({ header: broken, main: [] }, "main");

      expect(store.getState().issues).toEqual([]);
      expect(store.getState().areaIssues.header).toBe(validateTree(broken).issues.length);
      expect(store.getState().areaIssues.main).toBe(0);
    });

    it("updates the open area's count as it is edited", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");

      expect(store.getState().areaIssues.main).toBe(store.getState().issues.length);
      expect(store.getState().areaIssues.header).toBe(0);
    });

    it("is empty for a document without areas", () => {
      expect(makeStore().getState().areaIssues).toEqual({});
    });
  });

  describe("markSaved", () => {
    it("clears dirtyElsewhere when the save carried the areas it was given", () => {
      const store = makeTemplate();
      store.getState().insert("pullQuote");
      store.getState().setArea("header");

      const sent = store.getState().tree;
      const sentRest = store.getState().doc.rest;
      store.getState().markSaving();
      store.getState().markSaved(sent, sentRest);

      expect(store.getState().dirty).toBe(false);
      expect(store.getState().dirtyElsewhere).toBe(false);
    });

    /**
     * The reference comparison on `rest` earns its keep here. Switching away and
     * back mid-flight leaves `tree` identical to what was sent, so the tree
     * check alone would report the document saved — while the edit made in the
     * other area in between was never in that payload.
     */
    it("stays dirty when another area was edited while the save was in flight", () => {
      const store = makeTemplate();
      const sent = store.getState().tree;
      const sentRest = store.getState().doc.rest;
      store.getState().markSaving();

      store.getState().setArea("header");
      store.getState().insert("pullQuote");
      store.getState().setArea("main");

      store.getState().markSaved(sent, sentRest);

      expect(store.getState().tree).toEqual(sent);
      expect(store.getState().dirty).toBe(true);
    });
  });
});
