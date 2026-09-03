import { describe, expect, it } from "vitest";

import type { BlockTree } from "./types";
import { rekeyBlockTree } from "./rekey";

describe("rekeyBlockTree", () => {
  it("deep-copies roots and descendants without changing content or references", () => {
    const source: BlockTree = [
      {
        _key: "parent",
        _type: "layoutContainer",
        settings: { label: "Feature" },
        children: [{ _key: "ref", _type: "patternRef", _ref: "pattern-id" }],
      },
    ];

    const clone = rekeyBlockTree(source);
    expect(clone[0]._key).not.toBe("parent");
    expect(clone[0].children?.[0]._key).not.toBe("ref");
    expect(clone[0].children?.[0]._ref).toBe("pattern-id");
    expect(clone[0].settings).toEqual({ label: "Feature" });
    expect(clone[0]).not.toBe(source[0]);
    expect(clone[0].settings).not.toBe(source[0].settings);
  });

  it("mints no duplicate keys across a batch", () => {
    const clone = rekeyBlockTree(
      Array.from({ length: 100 }, (_, index) => ({
        _key: `source-${index}`,
        _type: "textElement",
      }))
    );
    expect(new Set(clone.map((node) => node._key)).size).toBe(100);
  });
});
