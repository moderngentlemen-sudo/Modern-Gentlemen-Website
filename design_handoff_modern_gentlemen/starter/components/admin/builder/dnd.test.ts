/**
 * The drag vocabulary, tested where it is testable.
 *
 * dnd-kit gives a drop nothing but two identifiers, so everything that decides
 * what a drop *means* lives in pure functions here rather than in the canvas.
 * The drag itself is proved in `tests/e2e/builder.spec.ts` — jsdom has no layout
 * engine, so a simulated one would only prove that the mock was called.
 */

import { describe, expect, it } from "vitest";

import { dropIndexFor, gapDropId, gapIndexes, libraryDragId, parseDragId } from "./dnd";

describe("parseDragId", () => {
  it("reads a library entry", () => {
    expect(parseDragId(libraryDragId("pullQuote"))).toEqual({ kind: "library", type: "pullQuote" });
  });

  it("reads a gap", () => {
    expect(parseDragId(gapDropId(3))).toEqual({ kind: "gap", index: 3 });
  });

  it("treats anything else as a block key", () => {
    // `newKey` mints `k_…`, so no block key can wear either prefix.
    expect(parseDragId("k_9f2c11ab")).toEqual({ kind: "block", key: "k_9f2c11ab" });
  });

  it("does not read a malformed gap as a gap", () => {
    expect(parseDragId("gap:x")).toEqual({ kind: "block", key: "gap:x" });
  });
});

describe("gapIndexes", () => {
  it("gives one insertion point before each block and one after the last", () => {
    expect(gapIndexes(3)).toEqual([0, 1, 2, 3]);
  });

  it("gives a single insertion point for an empty page", () => {
    expect(gapIndexes(0)).toEqual([0]);
  });
});

describe("dropIndexFor", () => {
  it("resolves a gap to its index", () => {
    expect(dropIndexFor(gapDropId(2), 4)).toBe(2);
  });

  it("clamps past the end of the tree", () => {
    expect(dropIndexFor(gapDropId(9), 4)).toBe(4);
  });

  it("refuses a block key — a library item may only land in a gap", () => {
    expect(dropIndexFor("k_9f2c11ab", 4)).toBeNull();
  });

  it("refuses nothing at all, which is a drop outside the canvas", () => {
    expect(dropIndexFor(null, 4)).toBeNull();
    expect(dropIndexFor(undefined, 4)).toBeNull();
  });

  it("resolves index 0 on an empty page", () => {
    expect(dropIndexFor(gapDropId(0), 0)).toBe(0);
  });
});
