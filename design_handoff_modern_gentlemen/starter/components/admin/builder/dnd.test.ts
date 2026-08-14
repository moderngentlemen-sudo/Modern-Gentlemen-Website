/**
 * The drag vocabulary, tested where it is testable.
 *
 * dnd-kit gives a drop nothing but two identifiers, so everything that decides
 * what a drop *means* lives in pure functions here rather than in the canvas.
 * The drag itself is proved in `tests/e2e/builder.spec.ts` — jsdom has no layout
 * engine, so a simulated one would only prove that the mock was called.
 */

import { describe, expect, it } from "vitest";

import { dropLocationFor, gapDropId, gapIndexes, libraryDragId, parseDragId } from "./dnd";

describe("parseDragId", () => {
  it("reads a library entry", () => {
    expect(parseDragId(libraryDragId("pullQuote"))).toEqual({ kind: "library", type: "pullQuote" });
  });

  it("reads a root gap", () => {
    expect(parseDragId(gapDropId(3))).toEqual({ kind: "gap", parentKey: null, index: 3 });
  });

  it("reads a gap inside a container", () => {
    expect(parseDragId(gapDropId(1, "k_abc"))).toEqual({
      kind: "gap",
      parentKey: "k_abc",
      index: 1,
    });
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

describe("dropLocationFor", () => {
  it("resolves a root gap", () => {
    expect(dropLocationFor(gapDropId(2))).toEqual({ parentKey: null, index: 2 });
  });

  it("resolves a gap inside a container", () => {
    expect(dropLocationFor(gapDropId(0, "k_abc"))).toEqual({ parentKey: "k_abc", index: 0 });
  });

  it("does not clamp — the list it lands in is what knows its own length", () => {
    expect(dropLocationFor(gapDropId(9))).toEqual({ parentKey: null, index: 9 });
  });

  it("refuses a block key — a drop must name a gap", () => {
    expect(dropLocationFor("k_9f2c11ab")).toBeNull();
  });

  it("refuses nothing at all, which is a drop outside the canvas", () => {
    expect(dropLocationFor(null)).toBeNull();
    expect(dropLocationFor(undefined)).toBeNull();
  });
});
