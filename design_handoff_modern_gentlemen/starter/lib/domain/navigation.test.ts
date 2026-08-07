import { describe, expect, it } from "vitest";

import {
  buildMenuTree,
  EDITABLE_MENU_LINK_TYPES,
  flattenChildren,
  groupChildren,
  hrefForItem,
  isMenuLinkType,
  MENU_LINK_TYPES,
  parseMenuItemOptions,
  parseMenuItemVisibility,
  type MenuItem,
} from "./navigation";
import { DEMO_MENUS } from "@/lib/demo/navigation";

const item = (over: Partial<MenuItem> & Pick<MenuItem, "id">): MenuItem => ({
  parentId: null,
  label: over.id,
  linkType: "url",
  targetId: null,
  url: "/",
  options: {},
  visibility: {},
  position: 0,
  ...over,
});

describe("buildMenuTree", () => {
  it("nests children under their parent and leaves roots at the top", () => {
    const tree = buildMenuTree([
      item({ id: "child", parentId: "root", position: 0 }),
      item({ id: "root", position: 0 }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children.map((c) => c.id)).toEqual(["child"]);
  });

  it("orders by position, then label, then id — so a menu with no positions set is still deterministic", () => {
    // `menu_items.position` defaults to 0, so every row of a hand-inserted menu
    // ties. An untied ordering is a bug that only shows up sometimes.
    const tree = buildMenuTree([
      item({ id: "c", label: "Beta" }),
      item({ id: "a", label: "Beta" }),
      item({ id: "b", label: "Alpha" }),
      item({ id: "d", label: "Alpha", position: -1 }),
    ]);

    expect(tree.map((n) => n.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("sorts nested levels too", () => {
    const tree = buildMenuTree([
      item({ id: "root" }),
      item({ id: "second", parentId: "root", position: 2 }),
      item({ id: "first", parentId: "root", position: 1 }),
    ]);

    expect(tree[0].children.map((n) => n.id)).toEqual(["first", "second"]);
  });

  it("drops anything unreachable from a root rather than looping on it", () => {
    // `on delete cascade` means an orphan cannot arise through the schema. A
    // cycle can still be written by hand in SQL, and a recursive walk would
    // never return from one.
    const tree = buildMenuTree([
      item({ id: "a", parentId: "b" }),
      item({ id: "b", parentId: "a" }),
      item({ id: "root" }),
    ]);

    expect(tree.map((n) => n.id)).toEqual(["root"]);
  });

  it("drops an item whose parent is not in the set", () => {
    expect(buildMenuTree([item({ id: "stray", parentId: "missing" })])).toEqual([]);
  });
});

describe("groupChildren", () => {
  it("groups by options.group in first-appearance order", () => {
    const [root] = buildMenuTree([
      item({ id: "root" }),
      item({ id: "one", parentId: "root", position: 1, options: { group: "Categories" } }),
      item({ id: "two", parentId: "root", position: 2, options: { group: "Guides" } }),
      item({ id: "three", parentId: "root", position: 3, options: { group: "Categories" } }),
    ]);

    expect(groupChildren(root.children)).toEqual([
      { heading: "Categories", items: [root.children[0], root.children[2]] },
      { heading: "Guides", items: [root.children[1]] },
    ]);
  });

  it("collects ungrouped children under a single heading-less column", () => {
    const [root] = buildMenuTree([
      item({ id: "root" }),
      item({ id: "one", parentId: "root", position: 1 }),
      item({ id: "two", parentId: "root", position: 2 }),
    ]);

    const columns = groupChildren(root.children);
    expect(columns).toHaveLength(1);
    expect(columns[0].heading).toBeNull();
    expect(columns[0].items).toHaveLength(2);
  });
});

describe("flattenChildren", () => {
  it("returns the drawer's flat sub-list in tree order, columns ignored", () => {
    const [root] = buildMenuTree([
      item({ id: "root" }),
      item({ id: "a", parentId: "root", position: 1, options: { group: "Categories" } }),
      item({ id: "b", parentId: "root", position: 2, options: { group: "Guides" } }),
      item({ id: "a1", parentId: "a", position: 1 }),
    ]);

    expect(flattenChildren(root.children).map((n) => n.id)).toEqual(["a", "a1", "b"]);
  });
});

describe("hrefForItem", () => {
  const slugs = {
    category: new Map([["cat-1", "style"]]),
    article: new Map([["art-1", "speed-considered"]]),
    page: new Map([["page-1", "home"]]),
    product: new Map([["prod-1", "field-jacket"]]),
  };

  it("returns a url item's own url", () => {
    expect(hrefForItem(item({ id: "x", linkType: "url", url: "/shop" }), slugs)).toBe("/shop");
  });

  it("resolves a target to its slug at read time, through the shared route helpers", () => {
    // The reason menu_items carries a link_type and a target_id rather than one
    // href column: renaming a slug moves every entry pointing at it.
    const at = (linkType: MenuItem["linkType"], targetId: string) =>
      hrefForItem(item({ id: "x", linkType, targetId, url: null }), slugs);

    expect(at("category", "cat-1")).toBe("/style");
    expect(at("article", "art-1")).toBe("/article/speed-considered");
    expect(at("product", "prod-1")).toBe("/product/field-jacket");
    // The home page's slug is not its path — the one special case.
    expect(at("page", "page-1")).toBe("/");
  });

  it("returns null when the target is gone, so the renderer can drop the item", () => {
    expect(
      hrefForItem(item({ id: "x", linkType: "category", targetId: "nope" }), slugs)
    ).toBeNull();
    expect(hrefForItem(item({ id: "x", linkType: "category", targetId: null }), slugs)).toBeNull();
  });

  it("returns null for a collection — the CHECK allows one and no public route serves it", () => {
    expect(
      hrefForItem(item({ id: "x", linkType: "collection", targetId: "coll-1" }), slugs)
    ).toBeNull();
    expect(EDITABLE_MENU_LINK_TYPES).not.toContain("collection");
  });
});

describe("the jsonb payloads", () => {
  it("parses what the admin writes", () => {
    const options = parseMenuItemOptions({
      group: "Guides",
      feature: { tag: "STYLE · 041", title: "Racing Green", image: "/i.jpg", href: "/style" },
    });
    expect(options.group).toBe("Guides");
    expect(options.feature?.title).toBe("Racing Green");

    expect(parseMenuItemVisibility({ auth: "in", member: null, devices: ["mobile"] })).toEqual({
      auth: "in",
      member: null,
      devices: ["mobile"],
    });
  });

  it("keeps unknown keys instead of dropping them on the next save", () => {
    expect(parseMenuItemOptions({ icon: "star" })).toEqual({ icon: "star" });
  });

  it("reads a malformed payload as an empty one rather than throwing", () => {
    // A bad `options` value must not be able to blank the site's navigation.
    expect(parseMenuItemOptions({ feature: { title: 12 } })).toEqual({});
    expect(parseMenuItemOptions(null)).toEqual({});
    expect(parseMenuItemVisibility("nonsense")).toEqual({});
  });
});

describe("the link-type vocabulary", () => {
  it("matches the CHECK in 0007_navigation_and_theme.sql", () => {
    expect([...MENU_LINK_TYPES]).toEqual([
      "page",
      "article",
      "category",
      "product",
      "collection",
      "url",
    ]);
    expect(isMenuLinkType("category")).toBe(true);
    expect(isMenuLinkType("nonsense")).toBe(false);
  });

  it("offers every type an editor can produce a working link with", () => {
    for (const type of EDITABLE_MENU_LINK_TYPES) expect(isMenuLinkType(type)).toBe(true);
  });
});

describe("the demo menus", () => {
  it("only reference link types the admin can also produce", () => {
    // lib/demo is the seed source; a seeded item an editor could not have
    // created is a shape the admin would then be unable to edit.
    const walk = (items: (typeof DEMO_MENUS)[number]["items"]): string[] =>
      items.flatMap((i) => [i.link.type, ...walk(i.children ?? [])]);

    for (const menu of DEMO_MENUS) {
      for (const type of walk(menu.items)) {
        expect(EDITABLE_MENU_LINK_TYPES).toContain(type);
      }
    }
  });

  it("gives every mega-menu child a column heading", () => {
    // A grouped column and an ungrouped one render differently; a child that
    // forgot its group would silently open a second, heading-less column.
    const header = DEMO_MENUS.find((m) => m.key === "header-primary");
    for (const entry of header?.items ?? []) {
      for (const child of entry.children ?? []) expect(child.group).toBeTruthy();
    }
  });

  it("has unique keys", () => {
    const keys = DEMO_MENUS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
