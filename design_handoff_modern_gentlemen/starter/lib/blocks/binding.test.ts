import { describe, expect, it } from "vitest";

import {
  applyBindings,
  collectBindings,
  isBindingDescriptor,
  resolveBindings,
  shapeRows,
} from "./binding";
import { demoBindingSources } from "./sources/demo";
import { blockProps } from "./normalize";
import { validateTree, formatIssues } from "./validate";
import type { BlockTree } from "./types";

const bound = (query: unknown) => ({ $bind: query });

const grid = (query: unknown): BlockTree => [
  {
    _key: "grid",
    _type: "articleGrid",
    label: "MORE IN STYLE",
    items: bound(query),
  },
];

describe("isBindingDescriptor", () => {
  it("recognises a descriptor", () => {
    expect(isBindingDescriptor(bound({ source: "articles" }))).toBe(true);
  });

  it("rejects literals and malformed descriptors", () => {
    expect(isBindingDescriptor([{ title: "A card" }])).toBe(false);
    expect(isBindingDescriptor({ $bind: { limit: 3 } })).toBe(false);
    expect(isBindingDescriptor(undefined)).toBe(false);
  });
});

describe("collectBindings", () => {
  it("finds a descriptor on a bindable field", () => {
    const requests = collectBindings(grid({ source: "articles", limit: 3 }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ id: "grid.items", blockKey: "grid", field: "items" });
  });

  it("ignores a descriptor on a field the manifest does not mark bindable", () => {
    // `pullQuote.quote` is not bindable; a descriptor there is just a bad value
    // for validation to report, not something to fetch.
    const requests = collectBindings([
      { _key: "q", _type: "pullQuote", quote: bound({ source: "articles" }), attribution: "A" },
    ]);
    expect(requests).toEqual([]);
  });

  it("finds descriptors nested under children", () => {
    const requests = collectBindings([
      {
        _key: "outer",
        _type: "articleGrid",
        label: "L",
        items: [],
        children: grid({ source: "articles" }),
      },
    ]);
    expect(requests.map((r) => r.blockKey)).toEqual(["grid"]);
  });

  it("reads a descriptor written in the builder's settings shape", () => {
    const requests = collectBindings([
      {
        _key: "grid",
        _type: "articleGrid",
        settings: { label: "L", items: bound({ source: "articles" }) },
      },
    ]);
    expect(requests).toHaveLength(1);
  });
});

describe("applyBindings", () => {
  const tree = grid({ source: "articles", limit: 2 });

  it("replaces the descriptor with the resolved value", () => {
    const items = [{ tag: "T", title: "A", read: "5 MIN", image: "/i.jpg", href: "/a" }];
    const next = applyBindings(tree, new Map([["grid.items", items]]));
    expect(blockProps(next[0]).items).toEqual(items);
  });

  it("leaves static fields untouched", () => {
    const next = applyBindings(tree, new Map([["grid.items", []]]));
    expect(blockProps(next[0]).label).toBe("MORE IN STYLE");
  });

  it("does not mutate the input tree", () => {
    applyBindings(tree, new Map([["grid.items", []]]));
    expect(blockProps(tree[0]).items).toEqual(bound({ source: "articles", limit: 2 }));
  });

  it("keeps the descriptor when nothing resolved it", () => {
    // A source that failed must not silently empty the page.
    const next = applyBindings(tree, new Map());
    expect(blockProps(next[0]).items).toEqual(bound({ source: "articles", limit: 2 }));
  });

  it("is order-independent across several bindings", () => {
    const two: BlockTree = [...grid({ source: "articles" }), ...gridNamed("second")];
    const a = new Map<string, unknown>([
      ["grid.items", [{ title: "one" }]],
      ["second.items", [{ title: "two" }]],
    ]);
    const b = new Map<string, unknown>([...a].reverse());
    expect(applyBindings(two, a)).toEqual(applyBindings(two, b));
  });
});

describe("shapeRows", () => {
  const rows = [
    { title: "b", order: 2 },
    { title: "a", order: 1 },
    { title: "c", order: 3 },
  ];

  it("sorts descending by default", () => {
    expect(shapeRows(rows, { source: "x", sort: { field: "order", direction: "desc" } })).toEqual([
      { title: "c", order: 3 },
      { title: "b", order: 2 },
      { title: "a", order: 1 },
    ]);
  });

  it("limits after sorting", () => {
    const out = shapeRows(rows, {
      source: "x",
      sort: { field: "order", direction: "asc" },
      limit: 2,
    }) as { title: string }[];
    expect(out.map((r) => r.title)).toEqual(["a", "b"]);
  });

  it("skips rows with offset, then counts the limit from there", () => {
    const out = shapeRows(rows, {
      source: "x",
      sort: { field: "order", direction: "asc" },
      offset: 1,
      limit: 2,
    }) as { title: string }[];
    // Not ["b"] — the limit counts rows kept, not rows passed over. This is the
    // pairing a category page uses: the lead takes row 1, the grid takes the rest.
    expect(out.map((r) => r.title)).toEqual(["b", "c"]);
  });

  it("treats an offset with no limit as 'everything after'", () => {
    const out = shapeRows(rows, {
      source: "x",
      sort: { field: "order", direction: "asc" },
      offset: 2,
    }) as { title: string }[];
    expect(out.map((r) => r.title)).toEqual(["c"]);
  });

  it("treats offset 0 as no offset", () => {
    expect(shapeRows(rows, { source: "x", offset: 0 })).toEqual(rows);
  });

  it("returns nothing when the offset runs past the end", () => {
    expect(shapeRows(rows, { source: "x", offset: 9, limit: 3 })).toEqual([]);
    expect(shapeRows(rows, { source: "x", offset: 9, single: true })).toBeNull();
  });

  it("renames keys via map", () => {
    expect(shapeRows([{ name: "N" }], { source: "x", map: { title: "name" } })).toEqual([
      { title: "N" },
    ]);
  });

  it("plucks a single field for scalar lists", () => {
    expect(shapeRows([{ slug: "a" }, { slug: "b" }], { source: "x", pluck: "slug" })).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns one record when single is set, and null when there are none", () => {
    expect(shapeRows([{ a: 1 }], { source: "x", single: true })).toEqual({ a: 1 });
    expect(shapeRows([], { source: "x", single: true })).toBeNull();
  });
});

describe("resolveBindings over the demo sources", () => {
  it("fills an article grid with real editorial content that then validates", async () => {
    const tree = grid({ source: "articles", filter: { category: "style" }, limit: 3 });
    const resolved = await resolveBindings(tree, demoBindingSources);

    const items = blockProps(resolved[0]).items as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveProperty("title");

    const result = validateTree(resolved);
    expect(result.ok, `\n${formatIssues(result.issues)}`).toBe(true);
  });

  it("resolves a single record into a group field", async () => {
    const tree: BlockTree = [
      {
        _key: "lead",
        _type: "featuredLead",
        article: bound({
          source: "articles",
          filter: { category: "watches", lead: true },
          single: true,
        }),
      },
    ];

    const resolved = await resolveBindings(tree, demoBindingSources);
    const article = blockProps(resolved[0]).article as Record<string, unknown>;
    expect(article.kicker).toMatch(/^WATCHES · /);
    expect(validateTree(resolved).ok).toBe(true);
  });

  it("projects source rows onto the target field's declared shape", async () => {
    // The demo rows carry `category` and `lead` so queries can filter on them.
    // Those must not survive onto a block whose item shape does not declare
    // them, or publish validation would reject every bound block.
    const resolved = await resolveBindings(
      grid({ source: "articles", limit: 1 }),
      demoBindingSources
    );
    const [item] = blockProps(resolved[0]).items as Record<string, unknown>[];
    expect(Object.keys(item).sort()).toEqual(["href", "image", "read", "tag", "title"]);
  });

  it("plucks product slugs into a scalar list", async () => {
    const tree: BlockTree = [
      {
        _key: "row",
        _type: "productRow",
        slugs: bound({ source: "products", filter: { group: "Watches" }, pluck: "slug", limit: 2 }),
      },
    ];

    const resolved = await resolveBindings(tree, demoBindingSources);
    const slugs = blockProps(resolved[0]).slugs as string[];
    expect(slugs).toHaveLength(2);
    expect(slugs.every((s) => typeof s === "string")).toBe(true);
    expect(validateTree(resolved).ok).toBe(true);
  });

  it("leaves the tree alone when there is nothing to bind", async () => {
    const tree: BlockTree = [{ _key: "q", _type: "pullQuote", quote: "Q", attribution: "A" }];
    expect(await resolveBindings(tree, demoBindingSources)).toEqual(tree);
  });

  it("keeps the descriptor when the source name is unknown", async () => {
    const tree = grid({ source: "nosuchsource" });
    const resolved = await resolveBindings(tree, demoBindingSources);
    expect(blockProps(resolved[0]).items).toEqual(bound({ source: "nosuchsource" }));
  });
});

function gridNamed(key: string): BlockTree {
  return [
    { _key: key, _type: "articleGrid", label: "L", items: { $bind: { source: "articles" } } },
  ];
}
