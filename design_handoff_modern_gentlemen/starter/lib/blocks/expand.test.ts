import { describe, expect, it } from "vitest";

import {
  MAX_EXPANSION_DEPTH,
  collectPatternRefs,
  expandPatterns,
  expandPatternsDetailed,
  patternBlocks,
} from "./expand";
import { flattenBlocks } from "./traverse";
import { validateTree } from "./validate";
import type { BlockTree } from "./types";

const quote = (key: string, text = "Q"): BlockTree[number] => ({
  _key: key,
  _type: "pullQuote",
  quote: text,
  attribution: "A",
});

const ref = (key: string, patternId: string): BlockTree[number] => ({
  _key: key,
  _type: "patternRef",
  _ref: patternId,
});

describe("collectPatternRefs", () => {
  it("finds refs at the top level and under children", () => {
    const refs = collectPatternRefs([
      ref("a", "pattern-1"),
      { ...quote("b"), children: [ref("c", "pattern-2")] },
    ]);
    expect(refs).toEqual([
      { blockKey: "a", patternId: "pattern-1" },
      { blockKey: "c", patternId: "pattern-2" },
    ]);
  });

  it("ignores ordinary blocks", () => {
    expect(collectPatternRefs([quote("a")])).toEqual([]);
  });
});

describe("patternBlocks", () => {
  it("reads the stored { blocks: [...] } shape", () => {
    expect(patternBlocks({ blocks: [quote("a")] })).toHaveLength(1);
  });

  it("accepts a bare array", () => {
    expect(patternBlocks([quote("a")])).toHaveLength(1);
  });

  it("yields nothing for a malformed payload", () => {
    expect(patternBlocks(null)).toEqual([]);
    expect(patternBlocks({ nope: true })).toEqual([]);
  });
});

describe("expandPatterns", () => {
  it("substitutes a ref for the pattern's blocks", () => {
    const tree = expandPatterns(
      [quote("before"), ref("usage", "p1"), quote("after")],
      new Map([["p1", { blocks: [quote("inner")] }]])
    );

    expect(tree.map((n) => n._type)).toEqual(["pullQuote", "pullQuote", "pullQuote"]);
    expect(tree).toHaveLength(3);
  });

  it("namespaces expanded keys so one pattern used twice does not collide", () => {
    const tree = expandPatterns(
      [ref("first", "p1"), ref("second", "p1")],
      new Map([["p1", { blocks: [quote("inner")] }]])
    );

    const keys = tree.map((n) => n._key);
    expect(keys).toEqual(["first:inner", "second:inner"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("expands a pattern that itself contains a ref", () => {
    const tree = expandPatterns(
      [ref("outer", "p1")],
      new Map<string, unknown>([
        ["p1", { blocks: [ref("mid", "p2")] }],
        ["p2", { blocks: [quote("leaf")] }],
      ])
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]._type).toBe("pullQuote");
    expect(tree[0]._key).toBe("outer:mid:leaf");
  });

  it("expands refs nested under children", () => {
    const tree = expandPatterns(
      [{ ...quote("host"), children: [ref("usage", "p1")] }],
      new Map([["p1", { blocks: [quote("inner")] }]])
    );

    expect(tree[0].children?.[0]._key).toBe("usage:inner");
  });

  it("produces a tree that still passes validation", () => {
    const tree = expandPatterns(
      [ref("usage", "p1")],
      new Map([["p1", { blocks: [quote("inner")] }]])
    );
    expect(validateTree(tree).ok).toBe(true);
  });
});

describe("unresolvable references", () => {
  it("leaves a missing pattern's node in place rather than dropping the section", () => {
    const { tree, unresolved } = expandPatternsDetailed([ref("usage", "gone")], new Map());

    expect(tree).toHaveLength(1);
    expect(tree[0]._key).toBe("usage");
    expect(unresolved).toEqual([{ blockKey: "usage", patternId: "gone" }]);
  });

  it("stops a pattern that references itself", () => {
    const { tree, unresolved } = expandPatternsDetailed(
      [ref("usage", "loop")],
      new Map([["loop", { blocks: [ref("inner", "loop")] }]])
    );

    // The outer ref expands once; the self-reference inside it is refused.
    expect(unresolved).toEqual([{ blockKey: "usage:inner", patternId: "loop" }]);
    expect(flattenBlocks(tree)).toHaveLength(1);
  });

  it("stops a cycle that runs through a second pattern", () => {
    const { unresolved } = expandPatternsDetailed(
      [ref("usage", "a")],
      new Map<string, unknown>([
        ["a", { blocks: [ref("toB", "b")] }],
        ["b", { blocks: [ref("toA", "a")] }],
      ])
    );

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].patternId).toBe("a");
  });

  it("caps runaway nesting at the depth limit", () => {
    // A chain longer than the cap: p0 -> p1 -> ... each a distinct pattern, so
    // the ancestor set never trips and only the depth guard can stop it.
    const patterns = new Map<string, unknown>();
    for (let i = 0; i < MAX_EXPANSION_DEPTH + 3; i++) {
      patterns.set(`p${i}`, { blocks: [ref(`n${i}`, `p${i + 1}`)] });
    }

    const { unresolved } = expandPatternsDetailed([ref("usage", "p0")], patterns);
    expect(unresolved).toHaveLength(1);
  });
});

describe("trees with no refs", () => {
  it("is left alone", () => {
    const tree: BlockTree = [quote("a"), quote("b")];
    expect(expandPatterns(tree, new Map())).toEqual(tree);
  });

  it("handles an absent tree", () => {
    expect(expandPatterns(undefined, new Map())).toEqual([]);
  });
});
