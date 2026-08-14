/**
 * The structural rules of a nested tree.
 *
 * Two invariants are asserted deliberately and repeatedly, because `store.ts`
 * rests on both: an operation that changes nothing returns the **same
 * reference** (so `commit` records no history entry), and untouched branches
 * keep their identity (so undo stays cheap).
 */

import { describe, expect, it } from "vitest";

import type { BlockNode, BlockTree } from "@/lib/blocks/types";

import { insertAfter, insertAt, locate, moveByKey, moveInto, removeByKey } from "./tree";

const leaf = (key: string): BlockNode => ({ _key: key, _type: "pullQuote" });
const box = (key: string, children: BlockNode[]): BlockNode => ({
  _key: key,
  _type: "columns",
  children,
});

/**  root: [ a, C1[ b, C2[ c ] ], d ]  */
const tree = (): BlockTree => [
  leaf("a"),
  box("C1", [leaf("b"), box("C2", [leaf("c")])]),
  leaf("d"),
];

describe("locate", () => {
  it("finds a root block", () => {
    expect(locate(tree(), "d")).toEqual({ parentKey: null, index: 2 });
  });

  it("finds a nested block, naming its container", () => {
    expect(locate(tree(), "b")).toEqual({ parentKey: "C1", index: 0 });
    expect(locate(tree(), "c")).toEqual({ parentKey: "C2", index: 0 });
  });

  it("returns null for a key that is not there", () => {
    expect(locate(tree(), "nope")).toBeNull();
  });
});

describe("insertAt", () => {
  it("appends to the root when no index is given", () => {
    expect(insertAt(tree(), leaf("new")).map((n) => n._key)).toEqual(["a", "C1", "d", "new"]);
  });

  it("inserts into a container at an index", () => {
    const next = insertAt(tree(), leaf("new"), "C1", 1);
    expect(next[1].children!.map((n) => n._key)).toEqual(["b", "new", "C2"]);
  });

  it("clamps an index past the end", () => {
    const next = insertAt(tree(), leaf("new"), "C1", 99);
    expect(next[1].children!.map((n) => n._key)).toEqual(["b", "C2", "new"]);
  });

  it("leaves the tree alone for an unknown parent", () => {
    const before = tree();
    expect(insertAt(before, leaf("new"), "nope", 0)).toBe(before);
  });

  it("shares the branches it did not touch", () => {
    const before = tree();
    const after = insertAt(before, leaf("new"), "C1", 0);
    // `a` and `d` are untouched and must not have been copied.
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after[1]).not.toBe(before[1]);
  });
});

describe("removeByKey", () => {
  it("removes a nested block", () => {
    const next = removeByKey(tree(), "b");
    expect(next[1].children!.map((n) => n._key)).toEqual(["C2"]);
  });

  it("removes a container and everything in it", () => {
    const next = removeByKey(tree(), "C1");
    expect(next.map((n) => n._key)).toEqual(["a", "d"]);
  });

  it("returns the same reference for an unknown key", () => {
    const before = tree();
    expect(removeByKey(before, "nope")).toBe(before);
  });
});

describe("insertAfter", () => {
  it("inserts into the same list as its anchor", () => {
    const next = insertAfter(tree(), "b", leaf("new"));
    expect(next[1].children!.map((n) => n._key)).toEqual(["b", "new", "C2"]);
  });
});

describe("moveByKey", () => {
  it("reorders within the root", () => {
    expect(moveByKey(tree(), "d", "a").map((n) => n._key)).toEqual(["d", "a", "C1"]);
  });

  it("moves a root block into a container", () => {
    const next = moveByKey(tree(), "a", "b");
    expect(next.map((n) => n._key)).toEqual(["C1", "d"]);
    expect(next[0].children!.map((n) => n._key)).toEqual(["a", "b", "C2"]);
  });

  it("moves a nested block back out to the root", () => {
    const next = moveByKey(tree(), "c", "a");
    expect(next.map((n) => n._key)).toEqual(["c", "a", "C1", "d"]);
    // C2, now empty, is still there — moving a block out does not tidy up its
    // container. An empty container is publish-invalid, not auto-removed.
    expect(next[2].children![1].children).toEqual([]);
  });

  it("moves between two containers", () => {
    const next = moveByKey(tree(), "b", "c");
    expect(next[1].children!.map((n) => n._key)).toEqual(["C2"]);
    expect(next[1].children![0].children!.map((n) => n._key)).toEqual(["b", "c"]);
  });

  it("refuses to drop a container into its own subtree", () => {
    // The move detaches before re-inserting, so the destination would cease to
    // exist mid-operation and the whole branch would be lost.
    const before = tree();
    expect(moveByKey(before, "C1", "c")).toBe(before);
    expect(moveByKey(before, "C1", "C2")).toBe(before);
  });

  it("returns the same reference when nothing can move", () => {
    const before = tree();
    expect(moveByKey(before, "a", "a")).toBe(before);
    expect(moveByKey(before, "nope", "a")).toBe(before);
    expect(moveByKey(before, "a", "nope")).toBe(before);
  });
});

describe("moveInto", () => {
  it("moves a block into a container at an index", () => {
    const next = moveInto(tree(), "d", "C1", 1);
    expect(next.map((n) => n._key)).toEqual(["a", "C1"]);
    expect(next[1].children!.map((n) => n._key)).toEqual(["b", "d", "C2"]);
  });

  it("moves a nested block out to a root position", () => {
    const next = moveInto(tree(), "c", null, 0);
    expect(next.map((n) => n._key)).toEqual(["c", "a", "C1", "d"]);
  });

  it("compensates for the removal when moving down its own list", () => {
    // `a` is at 0; the gap "after d" is index 3 before the removal and 2 after.
    const next = moveInto(tree(), "a", null, 3);
    expect(next.map((n) => n._key)).toEqual(["C1", "d", "a"]);
  });

  it("treats both gaps around a block as a no-op", () => {
    const before = tree();
    expect(moveInto(before, "a", null, 0)).toBe(before);
    expect(moveInto(before, "a", null, 1)).toBe(before);
  });

  it("refuses to move a container into itself", () => {
    const before = tree();
    expect(moveInto(before, "C1", "C1", 0)).toBe(before);
    expect(moveInto(before, "C1", "C2", 0)).toBe(before);
  });
});
