import { describe, expect, it } from "vitest";

import {
  AREAS_KEY,
  DEFAULT_AREA_NAME,
  areaNameOf,
  areaNamesOf,
  areaTreeKey,
  isAreaName,
  readArea,
  readAreas,
  withArea,
  withRenamedArea,
  withoutArea,
} from "./areas";
import type { BlockNode } from "./types";

const block = (key: string): BlockNode => ({ _key: key, _type: "sectionHeading", settings: {} });

describe("area names", () => {
  it("accepts slug shapes and refuses everything else", () => {
    expect(isAreaName("main")).toBe(true);
    expect(isAreaName("above-the-fold")).toBe(true);
    expect(isAreaName("area2")).toBe(true);

    expect(isAreaName("")).toBe(false);
    expect(isAreaName("Main")).toBe(false);
    expect(isAreaName("above the fold")).toBe(false);
    expect(isAreaName("-main")).toBe(false);
    expect(isAreaName("main-")).toBe(false);
  });

  // A dot in an area name would make `areas.a.b.0.headline` ambiguous: is the
  // area `a`, or `a.b`? `stripTreePrefix` cannot tell, and an issue would land
  // on the wrong control or on none.
  it("refuses a name holding a dot, which is what keeps issue paths parseable", () => {
    expect(isAreaName("a.b")).toBe(false);
    expect(areaNameOf("areas.a.b")).toBeNull();
  });
});

describe("areaTreeKey / areaNameOf", () => {
  it("round-trips", () => {
    expect(areaTreeKey("main")).toBe("areas.main");
    expect(areaNameOf(areaTreeKey("main"))).toBe("main");
  });

  it("returns null for the one-tree types' plain keys", () => {
    expect(areaNameOf("sections")).toBeNull();
    expect(areaNameOf("blocks")).toBeNull();
    // The bare key names the map, not an area inside it.
    expect(areaNameOf(AREAS_KEY)).toBeNull();
  });
});

describe("readAreas", () => {
  it("reads every array-valued area", () => {
    const payload = { areas: { main: [block("a")], header: [] } };
    expect(Object.keys(readAreas(payload)).sort()).toEqual(["header", "main"]);
  });

  // `0003` defaults the column to `{"areas":{}}`, and a template seeded before
  // the editor existed may hold anything. Opening one must not throw.
  it("tolerates a payload that is empty, null or the wrong shape", () => {
    expect(readAreas(null)).toEqual({});
    expect(readAreas({})).toEqual({});
    expect(readAreas({ areas: {} })).toEqual({});
    expect(readAreas({ areas: null })).toEqual({});
    expect(readAreas({ areas: [] })).toEqual({});
    expect(readAreas({ areas: "main" })).toEqual({});
  });

  it("skips an area whose value is not a list of blocks", () => {
    expect(readAreas({ areas: { main: [block("a")], broken: "nope" } })).toEqual({
      main: [block("a")],
    });
  });
});

describe("areaNamesOf", () => {
  // Postgres jsonb sorts keys by length then bytewise, so the order a payload
  // was written in is not the order it reads back in. Sorting here is what makes
  // the switcher's order the same on every load — see the module header.
  it("sorts alphabetically rather than trusting key order", () => {
    expect(areaNamesOf({ areas: { main: [], header: [], footer: [], a: [] } })).toEqual([
      "a",
      "footer",
      "header",
      "main",
    ]);
  });

  it("is empty for a template that has none", () => {
    expect(areaNamesOf({ areas: {} })).toEqual([]);
  });
});

describe("readArea", () => {
  it("reads one area's tree", () => {
    expect(readArea({ areas: { main: [block("a")] } }, "main")).toEqual([block("a")]);
  });

  it("reads an absent area as empty rather than undefined", () => {
    expect(readArea({ areas: {} }, "main")).toEqual([]);
  });
});

describe("withArea", () => {
  it("replaces one area and leaves the others alone", () => {
    const payload = { areas: { main: [block("a")], header: [block("h")] } };
    const next = withArea(payload, "main", [block("b")]);

    expect(next.areas).toEqual({ main: [block("b")], header: [block("h")] });
  });

  it("adds an area that did not exist", () => {
    expect(withArea({ areas: {} }, "main", [block("a")]).areas).toEqual({ main: [block("a")] });
  });

  // The same contract `rest` has always carried: a save must never drop a key
  // the builder does not edit.
  it("carries every other payload key through untouched", () => {
    const next = withArea({ areas: {}, seo: { title: "T" } }, "main", []);
    expect(next.seo).toEqual({ title: "T" });
  });

  it("does not mutate its input", () => {
    const payload = { areas: { main: [block("a")] } };
    withArea(payload, "main", []);
    expect(payload.areas.main).toEqual([block("a")]);
  });
});

describe("withoutArea", () => {
  it("removes one area", () => {
    const next = withoutArea({ areas: { main: [], header: [] } }, "main");
    expect(areaNamesOf(next)).toEqual(["header"]);
  });

  it("is a no-op for an area that is not there", () => {
    expect(areaNamesOf(withoutArea({ areas: { main: [] } }, "ghost"))).toEqual(["main"]);
  });

  it("does not mutate its input", () => {
    const payload = { areas: { main: [], header: [] } };
    withoutArea(payload, "main");
    expect(Object.keys(payload.areas).sort()).toEqual(["header", "main"]);
  });
});

describe("withRenamedArea", () => {
  it("moves the blocks to the new name", () => {
    const next = withRenamedArea({ areas: { main: [block("a")] } }, "main", "body");
    expect(next.areas).toEqual({ body: [block("a")] });
  });

  // A rename onto an occupied name would silently destroy one of the two areas.
  // Refusing here means the caller can report it; merging would be unnoticeable.
  it("refuses to overwrite an existing area", () => {
    const payload = { areas: { main: [block("a")], header: [block("h")] } };
    expect(withRenamedArea(payload, "main", "header")).toBe(payload);
  });

  it("is a no-op for an absent source or an unchanged name", () => {
    const payload = { areas: { main: [] } };
    expect(withRenamedArea(payload, "ghost", "body")).toBe(payload);
    expect(withRenamedArea(payload, "main", "main")).toBe(payload);
  });
});

describe("DEFAULT_AREA_NAME", () => {
  it("is a legal area name", () => {
    expect(isAreaName(DEFAULT_AREA_NAME)).toBe(true);
  });
});
