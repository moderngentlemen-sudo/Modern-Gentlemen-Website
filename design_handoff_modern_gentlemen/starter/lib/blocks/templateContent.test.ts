import { describe, expect, it } from "vitest";

import {
  applyTemplate,
  collectContentMarkers,
  DOCUMENT_CONTENT_TYPE,
  findContentArea,
  TEMPLATE_SEED_AREA,
} from "./templateContent";
import type { BlockNode, BlockTree } from "./types";

function block(key: string, type = "masthead", children?: BlockTree): BlockNode {
  return { _key: key, _type: type, settings: {}, ...(children ? { children } : {}) };
}

const marker = (key = "m") => block(key, DOCUMENT_CONTENT_TYPE);

describe("collectContentMarkers", () => {
  it("finds a marker at the top level", () => {
    expect(collectContentMarkers([block("a"), marker("m"), block("b")])).toEqual(["m"]);
  });

  it("finds one nested inside a container, which is the case that matters", () => {
    // A marker inside a column is the interesting arrangement, not the edge
    // case: it is how a template puts the page inside a layout rather than
    // merely above or below one.
    const tree = [block("row", "columns", [block("col", "column", [marker("deep")])])];
    expect(collectContentMarkers(tree)).toEqual(["deep"]);
  });

  it("reports every marker, because the count is what validation acts on", () => {
    const tree = [
      marker("one"),
      block("row", "columns", [block("col", "column", [marker("two")])]),
    ];
    expect(collectContentMarkers(tree)).toEqual(["one", "two"]);
  });

  it("is empty for a tree with none, and for no tree at all", () => {
    expect(collectContentMarkers([block("a")])).toEqual([]);
    expect(collectContentMarkers(undefined)).toEqual([]);
  });
});

describe("applyTemplate", () => {
  const sections = [block("s1"), block("s2")];

  it("replaces the marker with the document's sections, in place", () => {
    const composed = applyTemplate([block("top"), marker(), block("bottom")], sections);

    expect(composed.map((n) => n._key)).toEqual(["top", "s1", "s2", "bottom"]);
  });

  it("splices rather than wraps — no extra node appears", () => {
    // The marker occupies a position; it must not survive as a container around
    // the content. An extra DOM node here is an extra node the sixteen visual
    // baselines never saw.
    const composed = applyTemplate([marker()], sections);

    expect(composed).toEqual(sections);
    expect(composed.some((n) => n._type === DOCUMENT_CONTENT_TYPE)).toBe(false);
  });

  it("substitutes a marker nested inside a container", () => {
    const composed = applyTemplate(
      [block("row", "columns", [block("col", "column", [marker()])])],
      sections
    );

    const col = composed[0].children?.[0];
    expect(col?.children?.map((n) => n._key)).toEqual(["s1", "s2"]);
  });

  it("returns the document's own sections when the template has no marker", () => {
    // The safe direction of the two. A template missing its marker is broken,
    // and losing the page's content is worse than losing its frame — the reader
    // came for the content. Publish validation refuses to create this state;
    // this is what happens if one exists anyway.
    const composed = applyTemplate([block("top"), block("bottom")], sections);

    expect(composed).toEqual(sections);
  });

  it("returns the document's own sections for an empty or absent area", () => {
    expect(applyTemplate([], sections)).toEqual(sections);
    expect(applyTemplate(undefined, sections)).toEqual(sections);
  });

  it("keeps the original node reference for branches it did not touch", () => {
    // Structural sharing, the same contract `tree.ts` keeps. An untouched
    // branch staying identical is what lets a caller diff cheaply.
    const untouched = block("row", "columns", [block("col", "column", [block("leaf")])]);
    const composed = applyTemplate([untouched, marker()], sections);

    expect(composed[0]).toBe(untouched);
  });

  it("substitutes an empty document without leaving the marker behind", () => {
    // A page with no sections yet still renders its template's frame, and the
    // marker must not survive as a stray null-rendering block.
    const composed = applyTemplate([block("top"), marker(), block("bottom")], []);

    expect(composed.map((n) => n._key)).toEqual(["top", "bottom"]);
  });

  it("mutates neither the area nor the sections", () => {
    const area = [block("top"), marker()];
    const areaBefore = structuredClone(area);
    const sectionsBefore = structuredClone(sections);

    applyTemplate(area, sections);

    expect(area).toEqual(areaBefore);
    expect(sections).toEqual(sectionsBefore);
  });
});

describe("findContentArea", () => {
  it("finds the area holding the marker, whatever it is called", () => {
    // The point of the whole indirection: an editor renaming their only area
    // must not unhook the template. A name-based rule made that ordinary edit
    // silently fatal, which is what the templates E2E caught.
    const areas = { body: [block("a"), marker()], header: [block("b")] };

    expect(findContentArea(areas)).toBe(areas.body);
  });

  it("ignores areas without a marker", () => {
    const areas = { footer: [block("a")], zzz: [marker()] };

    expect(findContentArea(areas)).toBe(areas.zzz);
  });

  it("finds one nested inside a container", () => {
    const areas = {
      main: [block("row", "columns", [block("col", "column", [marker()])])],
    };

    expect(findContentArea(areas)).toBe(areas.main);
  });

  it("returns null when nothing holds a marker", () => {
    expect(findContentArea({ main: [block("a")] })).toBeNull();
    expect(findContentArea({})).toBeNull();
  });

  it("resolves alphabetically when two areas hold one, so it is deterministic", () => {
    // Publish validation refuses this state. If it exists anyway, jsonb key
    // order is not something to depend on — see the header on ordering.
    const areas = { zeta: [marker("z")], alpha: [marker("a")] };

    expect(findContentArea(areas)).toBe(areas.alpha);
  });
});

describe("TEMPLATE_SEED_AREA", () => {
  it("matches the area name a new template is created with", () => {
    // Guards the pairing rather than the string: `createTemplate` seeds
    // `DEFAULT_AREA_NAME`, and this is the name validation points its
    // "needs a Page content block" issue at.
    expect(TEMPLATE_SEED_AREA).toBe("main");
  });
});
