import { describe, expect, it } from "vitest";

import { diffBlockTrees, isUnchanged, summariseDiff } from "./diff";
import type { BlockTree } from "./types";

const quote = (key: string, text = "Q"): BlockTree[number] => ({
  _key: key,
  _type: "pullQuote",
  quote: text,
  attribution: "A",
});

describe("diffBlockTrees", () => {
  it("reports an identical tree as unchanged", () => {
    const tree: BlockTree = [quote("a"), quote("b")];
    const diff = diffBlockTrees(tree, tree);

    expect(isUnchanged(diff)).toBe(true);
    expect(diff.unchanged).toEqual(["a", "b"]);
  });

  it("reports additions and removals by key", () => {
    const diff = diffBlockTrees([quote("a"), quote("b")], [quote("b"), quote("c")]);

    expect(diff.removed).toEqual(["a"]);
    expect(diff.added).toEqual(["c"]);
  });

  it("reports an edited block as changed, not as add plus remove", () => {
    const diff = diffBlockTrees([quote("a", "before")], [quote("a", "after")]);

    expect(diff.changed).toEqual(["a"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("distinguishes a move from an edit", () => {
    const diff = diffBlockTrees([quote("a"), quote("b")], [quote("b"), quote("a")]);

    expect(diff.moved.sort()).toEqual(["a", "b"]);
    expect(diff.changed).toEqual([]);
  });

  it("does not report a storage-shape change as an edit", () => {
    // The same content, once in the legacy flat shape and once in the shape the
    // builder writes. Normalizing before comparing is what makes these equal.
    const flat: BlockTree = [{ _key: "a", _type: "pullQuote", quote: "Q", attribution: "A" }];
    const nested: BlockTree = [
      { _key: "a", _type: "pullQuote", settings: { quote: "Q", attribution: "A" } },
    ];

    expect(isUnchanged(diffBlockTrees(flat, nested))).toBe(true);
  });

  it("does not report key ordering as an edit", () => {
    const one: BlockTree = [{ _key: "a", _type: "pullQuote", quote: "Q", attribution: "A" }];
    const two: BlockTree = [{ _key: "a", _type: "pullQuote", attribution: "A", quote: "Q" }];

    expect(isUnchanged(diffBlockTrees(one, two))).toBe(true);
  });

  it("treats a changed block type as an edit", () => {
    const diff = diffBlockTrees(
      [quote("a")],
      [{ _key: "a", _type: "manifesto", label: "L", paragraphs: ["p"] }]
    );
    expect(diff.changed).toEqual(["a"]);
  });

  it("walks nested children", () => {
    const before: BlockTree = [{ ...quote("host"), children: [quote("kid", "before")] }];
    const after: BlockTree = [{ ...quote("host"), children: [quote("kid", "after")] }];

    expect(diffBlockTrees(before, after).changed).toEqual(["kid"]);
  });

  it("handles an absent tree on either side", () => {
    expect(diffBlockTrees(undefined, [quote("a")]).added).toEqual(["a"]);
    expect(diffBlockTrees([quote("a")], undefined).removed).toEqual(["a"]);
    expect(isUnchanged(diffBlockTrees(undefined, undefined))).toBe(true);
  });
});

describe("summariseDiff", () => {
  it("reads as a one-line history entry", () => {
    const diff = diffBlockTrees([quote("a"), quote("b")], [quote("a", "edited"), quote("c")]);
    expect(summariseDiff(diff)).toBe("1 added · 1 removed · 1 changed");
  });

  it("says so when nothing changed", () => {
    expect(summariseDiff(diffBlockTrees([quote("a")], [quote("a")]))).toBe("no changes");
  });
});
