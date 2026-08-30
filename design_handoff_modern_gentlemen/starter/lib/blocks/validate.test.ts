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

  it("accepts bounded section spacing and reports unknown values", () => {
    expect(validateBlock(quote({ design: { spaceBefore: "large" } })).ok).toBe(true);

    const result = validateBlock(
      quote({ design: { spaceAfter: "enormous" } as unknown as BlockNode["design"] })
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toContain("design.spaceAfter");
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

/**
 * The unrestricted container: a `column`, which takes any block.
 *
 * It was `columns` until that row's slot narrowed to `allow: ["column"]`. The
 * row is now the *restricted* container and gets its own cases below.
 */
const columns = (children: BlockNode[], props: Partial<BlockNode> = {}): BlockNode => ({
  _key: "c1",
  _type: "column",
  children,
  ...props,
});

/** The row: `allow: ["column"]`, `min: 1`, `max: 4`. */
const row = (children: BlockNode[]): BlockNode => ({
  _key: "r1",
  _type: "columns",
  children,
});

const column = (key = "col1", children: BlockNode[] = []): BlockNode => ({
  _key: key,
  _type: "column",
  children,
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

  it("accepts an empty column, because an empty cell is a layout choice", () => {
    // A column declares no `min`, unlike the row: leaving one blank is how a
    // row offsets its content, not a half-finished edit.
    expect(validateBlock(columns([])).ok).toBe(true);
  });

  it("refuses an empty row, so one cannot be published blank", () => {
    const result = validateBlock(row([]));
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toMatch(/at least 1 block/);
  });

  it("refuses more columns than the row holds", () => {
    const five = Array.from({ length: 5 }, (_, i) => column(`col${i}`));
    const result = validateBlock(row(five));
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toMatch(/at most 4 blocks/);
  });

  it("refuses a section as a direct child of a row, naming the block", () => {
    // `columns` is the first shipped manifest to use `allow`, which this file
    // could previously only exercise by constructing a slot by hand. A section
    // in a row is exactly the data the old flat model produced, so this is also
    // what a document written before the change reports as.
    const result = validateBlock(row([column(), quote()]));

    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.message)).toContainEqual(
      expect.stringContaining('"pullQuote" is not allowed')
    );
  });

  it("reports a disallowed child against its own index", () => {
    // Driven through `slotIssues` directly, with a slot built by hand: it keeps
    // the assertion about the *mechanism* rather than about whichever types
    // today's manifests happen to permit.
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
    // An empty *row*: a column may be blank, a row may not, so this is the one
    // that still reports.
    const result = validateTree([row([])]);
    expect(result.issues.map((i) => i.key)).toContain("r1");
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
