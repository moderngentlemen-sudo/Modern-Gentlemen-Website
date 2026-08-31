import { describe, expect, it } from "vitest";

import {
  FRAMED_CONTENT_TYPES,
  framedContentTypeFor,
  framedContentTypesFor,
  isTemplateKind,
  TEMPLATE_KIND_DESCRIPTION,
  TEMPLATE_KINDS,
} from "./templates";

describe("TEMPLATE_KINDS", () => {
  it("mirrors the CHECK constraint in 0003, in the order it declares", () => {
    // Not decoration: `createTemplate` writes this value straight into the
    // column, so a kind here that the constraint does not know produces a
    // 23514 on save rather than a refusal the editor can read.
    expect([...TEMPLATE_KINDS]).toEqual([
      "page",
      "article",
      "product",
      "archive",
      "header",
      "footer",
      "section",
    ]);
  });

  it("describes every kind, because the one place it is chosen is the one place it is explained", () => {
    // A kind cannot be changed after creation — `template_assignments` resolves
    // against it — so an undescribed kind is a choice made blind and never
    // revisited.
    for (const kind of TEMPLATE_KINDS) {
      expect(TEMPLATE_KIND_DESCRIPTION[kind]?.trim(), kind).toBeTruthy();
    }
  });

  it("recognises its own members and nothing else", () => {
    for (const kind of TEMPLATE_KINDS) expect(isTemplateKind(kind)).toBe(true);
    expect(isTemplateKind("archive ")).toBe(false);
    expect(isTemplateKind("Page")).toBe(false);
    expect(isTemplateKind("category")).toBe(false);
  });
});

describe("framedContentTypeFor", () => {
  it("frames a page from `page` and a category from `archive`", () => {
    // The two section-driven public routes, and the whole reason this map
    // exists: `/` renders a page's blocks, `/[category]` renders a category's.
    expect(framedContentTypeFor("page")).toBe("page");
    expect(framedContentTypeFor("archive")).toBe("category");
  });

  it("maps detail routes and global parts, leaving only section unassigned", () => {
    expect(framedContentTypeFor("article")).toBe("article");
    expect(framedContentTypeFor("product")).toBe("product");
    expect(framedContentTypeFor("header")).toBe("header");
    expect(framedContentTypeFor("footer")).toBe("footer");
    expect(framedContentTypeFor("section")).toBeNull();
    expect(framedContentTypesFor("archive")).toEqual(["category", "shop"]);
  });

  it("decides for every kind, so a new one cannot default to framing nothing", () => {
    // The guard that matters. `archive` sat unrendered for two phases while
    // looking deliberate; a Record over the vocabulary makes the next such kind
    // a type error at the declaration and a failure here if someone widens the
    // type without widening the map.
    for (const kind of TEMPLATE_KINDS) {
      expect(Object.hasOwn(FRAMED_CONTENT_TYPES, kind), kind).toBe(true);
    }
    expect(Object.keys(FRAMED_CONTENT_TYPES).sort()).toEqual([...TEMPLATE_KINDS].sort());
  });

  it("only ever names a content type something can actually frame", () => {
    // `publicContent.ts`'s FRAMEABLE map turns these into table names. A value
    // here with no entry there would resolve a template to a table that does
    // not exist, which is the pairing this test exists to keep honest.
    for (const kind of TEMPLATE_KINDS) {
      const framed = framedContentTypeFor(kind);
      if (framed !== null) {
        expect(["page", "category", "article", "product", "header", "footer"]).toContain(framed);
      }
    }
  });
});
