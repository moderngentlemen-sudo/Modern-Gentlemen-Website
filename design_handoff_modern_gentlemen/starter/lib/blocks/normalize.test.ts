import { describe, expect, it } from "vitest";

import { blockProps, normalizeBlock } from "./normalize";
import type { BlockNode } from "./types";

const node = (props: Partial<BlockNode>): BlockNode => ({
  _key: "k",
  _type: "pullQuote",
  ...props,
});

describe("blockProps", () => {
  it("accepts the legacy flat shape", () => {
    expect(blockProps(node({ quote: "Q", attribution: "A" }))).toEqual({
      quote: "Q",
      attribution: "A",
    });
  });

  it("accepts the builder's settings shape", () => {
    expect(blockProps(node({ settings: { quote: "Q", attribution: "A" } }))).toEqual({
      quote: "Q",
      attribution: "A",
    });
  });

  it("lets settings win over a flat prop of the same name", () => {
    const merged = blockProps(node({ quote: "old", settings: { quote: "new" } }));
    expect(merged.quote).toBe("new");
  });

  it("never leaks structural keys into props", () => {
    const props = blockProps(
      node({
        quote: "Q",
        children: [],
        visibility: { hidden: true },
        locked: true,
        _ref: "pattern-1",
      })
    );
    expect(Object.keys(props)).toEqual(["quote"]);
  });
});

describe("normalizeBlock", () => {
  it("applies the manifest's defaults", () => {
    const props = normalizeBlock(node({ quote: "Q", attribution: "A" }));
    expect(props.size).toBe("lg");
  });

  it("drops props the manifest does not declare", () => {
    const props = normalizeBlock(node({ quote: "Q", attribution: "A", notAField: 1 }));
    expect(props).not.toHaveProperty("notAField");
  });

  it("is idempotent", () => {
    const once = normalizeBlock(node({ quote: "Q", attribution: "A" }));
    expect(normalizeBlock({ _key: "k", _type: "pullQuote", ...once })).toEqual(once);
  });

  it("passes an unknown block type through untouched", () => {
    // The renderer's MissingBlock fallback handles these; normalization must
    // not be the thing that decides a block is unrenderable.
    const props = normalizeBlock({ _key: "k", _type: "notARealBlock", anything: true });
    expect(props).toEqual({ anything: true });
  });

  it("falls back to raw props rather than failing a render on invalid content", () => {
    // `attribution` is required. Validation reports that; the render path must
    // still hand the component what it has.
    const props = normalizeBlock(node({ quote: "Q" }));
    expect(props).toEqual({ quote: "Q" });
  });
});
