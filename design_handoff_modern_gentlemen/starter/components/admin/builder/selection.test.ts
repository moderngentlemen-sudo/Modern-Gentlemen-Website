import { describe, expect, it } from "vitest";

import type { BlockTree } from "@/lib/blocks/types";

import { keysOf } from "./node";
import { selectionAsPatternBlocks, topmostSelectedKeys } from "./selection";

const tree: BlockTree = [
  { _key: "first", _type: "sectionHeading", settings: { heading: "First" } },
  {
    _key: "container",
    _type: "layoutContainer",
    children: [
      { _key: "nested-a", _type: "pullQuote", settings: { quote: "A" } },
      { _key: "nested-b", _type: "pullQuote", settings: { quote: "B" } },
    ],
  },
  { _key: "last", _type: "sectionHeading", settings: { heading: "Last" } },
];

describe("topmostSelectedKeys", () => {
  it("returns selected branches in document order rather than click order", () => {
    expect(topmostSelectedKeys(tree, new Set(["last", "first"]))).toEqual(["first", "last"]);
  });

  it("suppresses a selected descendant when its ancestor is selected", () => {
    expect(topmostSelectedKeys(tree, new Set(["nested-a", "container"]))).toEqual(["container"]);
  });
});

describe("selectionAsPatternBlocks", () => {
  it("deep-copies selected branches and replaces every source key", () => {
    const blocks = selectionAsPatternBlocks(tree, ["container", "last"]);
    const sourceKeys = keysOf(tree);
    const resultKeys = keysOf(blocks);

    expect(blocks.map((block) => block._type)).toEqual(["layoutContainer", "sectionHeading"]);
    expect(resultKeys.size).toBe(4);
    expect([...resultKeys].every((key) => !sourceKeys.has(key))).toBe(true);
    expect(blocks[0]).not.toBe(tree[1]);
    expect(blocks[0].children?.[0]).not.toBe(tree[1].children?.[0]);
  });

  it("ignores stale selection keys", () => {
    expect(selectionAsPatternBlocks(tree, ["missing"])).toEqual([]);
  });
});
