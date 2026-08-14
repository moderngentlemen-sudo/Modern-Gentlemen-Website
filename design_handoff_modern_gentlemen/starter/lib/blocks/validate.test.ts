import { describe, expect, it } from "vitest";

import { slotIssues, validateBlock, validateTree } from "./validate";
import type { BlockNode } from "./types";

const quote = (props: Partial<BlockNode> = {}): BlockNode => ({
  _key: "q1",
  _type: "pullQuote",
  quote: "Q",
  attribution: "A",
  ...props,
});

describe("validateBlock", () => {
  it("accepts a complete block", () => {
    expect(validateBlock(quote()).ok).toBe(true);
  });

  it("reports a missing required field at its own path", () => {
    const result = validateBlock({ _key: "q1", _type: "pullQuote", quote: "Q" });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain("attribution");
    expect(result.issues[0].key).toBe("q1");
  });

  it("reports a wrong type", () => {
    const result = validateBlock(quote({ size: 42 }));
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain("size");
  });

  it("reports a prop the manifest does not declare", () => {
    // An undeclared prop usually means the manifest has fallen behind its
    // component, which is exactly what this suite exists to surface.
    const result = validateBlock(quote({ inventedField: "x" }));
    expect(result.ok).toBe(false);
  });

  it("reports an unknown block type without throwing", () => {
    const result = validateBlock({ _key: "x", _type: "notARealBlock" });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toMatch(/Unknown block type/);
  });

  it("reports a missing _key", () => {
    // Deliberately malformed: a node stored without a key. `as unknown` because
    // that is exactly the shape BlockNode forbids and validation must catch.
    const result = validateBlock({
      _type: "pullQuote",
      quote: "Q",
      attribution: "A",
    } as unknown as BlockNode);
    expect(result.issues.map((i) => i.path)).toContain("_key");
  });

  it("paths an issue inside a list item by index", () => {
    const result = validateBlock({
      _key: "m",
      _type: "masthead",
      label: "THE MASTHEAD",
      people: [
        { initial: "A", name: "A. Bellamy", role: "EDITOR" },
        { initial: "C", name: "C. Vance" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain("people.1.role");
  });

  it("paths an issue inside a nested group", () => {
    const result = validateBlock({
      _key: "l",
      _type: "featuredLead",
      article: { kicker: "STYLE · 001", title: "T", image: "/i.jpg" },
    });
    expect(result.issues.map((i) => i.path)).toContain("article.href");
  });
});

/** A container holding whatever it is given. `columns` is the only one today. */
const columns = (children: BlockNode[], props: Partial<BlockNode> = {}): BlockNode => ({
  _key: "c1",
  _type: "columns",
  children,
  ...props,
});

describe("child slots", () => {
  it("accepts children on a block whose manifest declares a slot", () => {
    expect(validateBlock(columns([quote()])).ok).toBe(true);
  });

  it("refuses children on a leaf", () => {
    // The other twenty-two blocks are leaves, and a tree that nests inside one
    // was built by something that ignored the manifest.
    const result = validateBlock({ ...quote(), children: [quote()] });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain("children");
  });

  it("refuses an empty container, so one cannot be published blank", () => {
    const result = validateBlock(columns([]));
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toMatch(/at least 1 block/);
  });

  it("refuses more children than the slot holds", () => {
    const five = Array.from({ length: 5 }, (_, i) => quote({ _key: `q${i}` }));
    const result = validateBlock(columns(five));
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toMatch(/at most 4 blocks/);
  });

  it("reports a disallowed child against its own index", () => {
    // Driven through `slotIssues` directly: `columns` accepts anything, so no
    // shipped manifest can reach this branch, and asserting it through one
    // would only prove that today's policy is today's policy.
    const node = columns([quote(), { _key: "n1", _type: "newsletter" }]);
    const issues = slotIssues(node, "c1", { label: "Columns", allow: ["pullQuote"] });

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("children.1");
    expect(issues[0].message).toMatch(/"newsletter" is not allowed/);
  });

  it("says nothing about a leaf with no children, which is every other block", () => {
    expect(slotIssues(quote(), "q1", undefined)).toEqual([]);
  });
});

describe("validateTree", () => {
  it("walks nested children", () => {
    const result = validateTree([columns([{ _key: "bad", _type: "pullQuote", quote: "Q" }])]);
    expect(result.ok).toBe(false);
    // The child's own missing `attribution`, found through the container.
    expect(result.issues.some((i) => i.key === "bad")).toBe(true);
  });

  it("validates a container and its children in one pass", () => {
    const result = validateTree([columns([])]);
    expect(result.issues.map((i) => i.key)).toContain("c1");
  });

  it("reports a duplicate key once", () => {
    const result = validateTree([quote(), quote()]);
    const duplicates = result.issues.filter((i) => i.message.includes("Duplicate _key"));
    expect(duplicates).toHaveLength(1);
  });

  it("accepts an empty or absent tree", () => {
    expect(validateTree([]).ok).toBe(true);
    expect(validateTree(undefined).ok).toBe(true);
  });
});
