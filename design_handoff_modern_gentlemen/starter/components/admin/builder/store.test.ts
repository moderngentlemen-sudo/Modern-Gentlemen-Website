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
import { reorderByKey } from "./dnd";

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

  it("reorderByKey leaves the tree alone for unknown keys", () => {
    const tree: BlockTree = [{ _key: "a", _type: "pullQuote" }];
    expect(reorderByKey(tree, "a", "nope")).toBe(tree);
    expect(reorderByKey(tree, "a", "a")).toBe(tree);
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
    store.getState().markSaving();
    store.getState().markSaved(sent);

    expect(store.getState().dirty).toBe(false);
    expect(store.getState().save.kind).toBe("saved");
  });

  it("stays dirty when an edit landed while the save was in flight", () => {
    const store = makeStore();
    store.getState().insert("pullQuote");

    const sent = store.getState().tree;
    store.getState().markSaving();
    store.getState().insert("masthead"); // the editor keeps typing
    store.getState().markSaved(sent);

    expect(store.getState().dirty).toBe(true);
    expect(store.getState().save.kind).toBe("dirty");
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
