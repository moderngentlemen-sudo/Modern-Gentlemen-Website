import { describe, expect, it } from "vitest";

import { cannotWrapInColumns, wrapInColumns } from "./arrange";
import { newBlockNode } from "./node";

describe("wrapInColumns", () => {
  const a = newBlockNode("nativeHeading");
  const b = newBlockNode("nativeText");
  const c = newBlockNode("nativeImage");

  it("puts sibling blocks side by side, in page order, where the first one was", () => {
    const { tree, key } = wrapInColumns([a, b, c], [c._key, b._key]);
    expect(tree.map((node) => node._type)).toEqual(["nativeHeading", "columns"]);
    const row = tree[1];
    expect(row._key).toBe(key);
    expect(row.settings?.ratio).toBe("1-1");
    expect(row.children?.map((column) => column._type)).toEqual(["column", "column"]);
    expect(row.children?.map((column) => column.children?.[0]._key)).toEqual([b._key, c._key]);
  });

  it("names a three-block row three equal", () => {
    expect(wrapInColumns([a, b, c], [a._key, b._key, c._key]).tree[0].settings?.ratio).toBe(
      "1-1-1"
    );
  });

  it("refuses, leaving the tree untouched, when it cannot", () => {
    const tree = [a, { ...b, locked: true }];
    expect(cannotWrapInColumns(tree, [a._key])).toMatch(/two to four/);
    expect(cannotWrapInColumns(tree, [a._key, b._key])).toMatch(/Unlock/);
    expect(wrapInColumns(tree, [a._key, b._key]).tree).toBe(tree);

    const row = newBlockNode("columns");
    const nested = [{ ...row, children: [{ ...row.children![0], children: [c] }] }, a];
    expect(cannotWrapInColumns(nested, [a._key, c._key])).toMatch(/same container/);
  });
});
