import { describe, expect, it } from "vitest";

import { ARTICLE_TEMPLATES } from "@/lib/demo/articles";
import {
  ARTICLE_TEMPLATE_LAYOUTS,
  ARTICLE_TEMPLATE_NAMES,
  DEFAULT_ARTICLE_TEMPLATE,
  authorInitial,
  composeByline,
  composeCardTag,
  composeKicker,
  isArticleTemplate,
  KEEP_READING_COUNT,
  layoutFor,
  normalizeRelatedIds,
  readingTimes,
  readingUnitFor,
} from "./articles";

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

/**
 * The layout map is the half of a template the public route needs, and it is
 * declared here rather than read from the demo module for the reason above. That
 * makes this the test that keeps them in step: the demo module is where the
 * prototype's `config()` was transcribed, so where the two disagree the demo
 * module is right and the map is the bug.
 */
describe("article layouts", () => {
  it("gives every named template the hero and body the library implements", () => {
    for (const name of ARTICLE_TEMPLATE_NAMES) {
      expect(ARTICLE_TEMPLATE_LAYOUTS[name]).toEqual({
        hero: ARTICLE_TEMPLATES[name].hero,
        body: ARTICLE_TEMPLATES[name].body,
      });
    }
  });

  it("covers exactly the named templates — no extras, none missing", () => {
    expect(Object.keys(ARTICLE_TEMPLATE_LAYOUTS).sort()).toEqual(
      [...ARTICLE_TEMPLATE_NAMES].sort()
    );
  });

  it("falls back to the default layout for an unknown template", () => {
    // A row whose `template` column holds something the library dropped still
    // renders, as the default rather than as a blank page.
    expect(layoutFor("Not A Template")).toEqual(ARTICLE_TEMPLATE_LAYOUTS[DEFAULT_ARTICLE_TEMPLATE]);
    expect(layoutFor("Cover Story")).toEqual({ hero: "cover", body: "prose" });
  });
});

describe("the strings an article page prints", () => {
  it("composes the kicker in caps, with the No. the design uses", () => {
    expect(composeKicker({ category: "Style", issue: "040" })).toBe("STYLE · NO. 040");
  });

  it("credits a photographer only when there is a photograph", () => {
    const base = { author: "A. Bellamy", read: "6 MIN" };
    expect(composeByline({ ...base, heroImage: "/images/hero-cover.jpg" })).toBe(
      "WORDS · A. BELLAMY · 6 MIN READ · PHOTOGRAPHY · E. MARLOWE"
    );
    // "Op-Ed" has no hero image and must not claim one.
    expect(composeByline(base)).toBe("WORDS · A. BELLAMY · 6 MIN READ");
  });

  it("takes the author's initial, and has something to show for a blank name", () => {
    expect(authorInitial("c. vance")).toBe("C");
    expect(authorInitial("   ")).toBe("M");
  });

  it("measures Film in films and everything else in reads", () => {
    // The lead card is the only place this shows: "12 MIN FILM" on /film,
    // "7 MIN READ" on the other four. It cannot be recovered from
    // `reading_minutes`, so losing it is silent — which is exactly what happened
    // until the integration deep-compare caught it on the film category.
    expect(readingTimes(12, "film")).toEqual({ read: "12 MIN", readLong: "12 MIN FILM" });
    expect(readingTimes(7, "style")).toEqual({ read: "7 MIN", readLong: "7 MIN READ" });
  });

  it("defaults an unknown or absent category to a read", () => {
    expect(readingTimes(5, "podcasts").readLong).toBe("5 MIN READ");
    expect(readingTimes(5, null).readLong).toBe("5 MIN READ");
    expect(readingUnitFor(undefined)).toBe("READ");
  });

  it("gives no reading time at all when there are no minutes", () => {
    // An empty string, not "0 MIN" — a missing reading time is honest, a
    // zero-minute read is a claim.
    expect(readingTimes(null, "film")).toEqual({ read: "", readLong: "" });
  });

  it("composes a card tag from a label and an issue", () => {
    // The label is the *subcategory* on a category card — "TAILORING · 040",
    // not "STYLE · 040" — which is why it is an argument rather than derived.
    expect(composeCardTag("Tailoring", "040")).toBe("TAILORING · 040");
  });
});

/**
 * The curated KEEP READING list.
 *
 * Every case here is one the database would otherwise answer with an error code
 * — `23514` for the self-reference, `23505` for the duplicate — so these are
 * assertions about which layer gets to be the one that explains the rule.
 */
describe("normalizeRelatedIds", () => {
  const self = "00000000-0000-0000-0000-00000000000a";
  const a = "00000000-0000-0000-0000-00000000000b";
  const b = "00000000-0000-0000-0000-00000000000c";
  const c = "00000000-0000-0000-0000-00000000000d";
  const d = "00000000-0000-0000-0000-00000000000e";

  it("keeps the editor's order, which is the whole reason `position` exists", () => {
    expect(normalizeRelatedIds(self, [c, a, b])).toEqual([c, a, b]);
  });

  it("drops the article itself rather than letting the CHECK refuse the write", () => {
    expect(normalizeRelatedIds(self, [a, self, b])).toEqual([a, b]);
  });

  it("collapses a duplicate to its first appearance, preserving the intended order", () => {
    expect(normalizeRelatedIds(self, [b, a, b])).toEqual([b, a]);
  });

  it("caps at what the grid renders", () => {
    expect(normalizeRelatedIds(self, [a, b, c, d])).toEqual([a, b, c]);
    expect(KEEP_READING_COUNT).toBe(3);
  });

  it("passes an empty list through — no curation is a real state, not a miss", () => {
    // It is what makes the public reader fall back to category siblings.
    expect(normalizeRelatedIds(self, [])).toEqual([]);
  });
});
