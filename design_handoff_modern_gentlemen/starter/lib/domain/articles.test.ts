import { describe, expect, it } from "vitest";

import { ARTICLE_TEMPLATES } from "@/lib/articles";
import { ARTICLE_TEMPLATE_NAMES, DEFAULT_ARTICLE_TEMPLATE, isArticleTemplate } from "./articles";

/**
 * Conformance between the typed vocabulary and the template library it names.
 *
 * The same argument `lib/blocks/conformance.test.ts` makes about manifests and
 * the component registry: two lists that must agree, kept apart on purpose, so
 * the thing that keeps them in step has to be a test rather than proximity.
 */
describe("article templates", () => {
  it("names exactly the templates the library implements", () => {
    expect([...ARTICLE_TEMPLATE_NAMES].sort()).toEqual(Object.keys(ARTICLE_TEMPLATES).sort());
  });

  it("has all twenty", () => {
    expect(ARTICLE_TEMPLATE_NAMES).toHaveLength(20);
  });

  it("defaults to a template that exists — and to the column's own default", () => {
    // `articles.template` defaults to 'Feature' in 0004. If these ever diverge,
    // an article created outside the admin would render as something else.
    expect(ARTICLE_TEMPLATES[DEFAULT_ARTICLE_TEMPLATE]).toBeDefined();
    expect(DEFAULT_ARTICLE_TEMPLATE).toBe("Feature");
  });

  it("recognises a real template and rejects anything else", () => {
    expect(isArticleTemplate("Cover Story")).toBe(true);
    expect(isArticleTemplate("cover story")).toBe(false);
    expect(isArticleTemplate("Not A Template")).toBe(false);
  });

  it("keeps the em dash in the one name that carries one", () => {
    // "Feature — Standard" uses an em dash, not a hyphen. A silent substitution
    // here would not match the library key and the article would fall back.
    expect(ARTICLE_TEMPLATE_NAMES).toContain("Feature — Standard");
  });
});
