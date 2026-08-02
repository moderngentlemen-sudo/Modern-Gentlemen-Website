import { describe, expect, it } from "vitest";

import { validateBlock, validateTree } from "./validate";
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

describe("validateTree", () => {
  it("walks nested children", () => {
    const result = validateTree([
      { ...quote(), children: [{ _key: "bad", _type: "pullQuote", quote: "Q" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.key === "bad")).toBe(true);
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
