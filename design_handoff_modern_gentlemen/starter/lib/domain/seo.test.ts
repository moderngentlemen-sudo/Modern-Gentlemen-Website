import { describe, expect, it } from "vitest";

import {
  articleJsonLd,
  BRAND,
  canonicalUrl,
  metaDescription,
  organizationJsonLd,
  pageTitle,
  productJsonLd,
  schemaAvailability,
} from "./seo";
import { PRODUCT_AVAILABILITIES } from "./products";

const SITE = "https://modern-gentlemen-website-production.up.railway.app";

describe("pageTitle", () => {
  it("suffixes the brand, matching the convention /article/[slug] set in Track A", () => {
    expect(pageTitle("Speed, Considered")).toBe("Speed, Considered — Modern Gentlemen");
  });

  it("is idempotent — a title already carrying the brand is left alone", () => {
    // Content that happens to mention the brand must not produce
    // "Modern Gentlemen — Modern Gentlemen".
    expect(pageTitle("Speed, Considered — Modern Gentlemen")).toBe(
      "Speed, Considered — Modern Gentlemen"
    );
    expect(pageTitle(BRAND)).toBe(BRAND);
  });

  it("falls back to the brand rather than a lonely dash", () => {
    expect(pageTitle(undefined)).toBe(BRAND);
    expect(pageTitle(null)).toBe(BRAND);
    expect(pageTitle("   ")).toBe(BRAND);
  });
});

describe("metaDescription", () => {
  it("collapses whitespace and trims", () => {
    expect(metaDescription("  a   b \n c ")).toBe("a b c");
  });

  it("returns short text untouched, with no ellipsis", () => {
    expect(metaDescription("Short enough.")).toBe("Short enough.");
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const long = `${"word ".repeat(50)}end`;
    const out = metaDescription(long)!;

    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    // The character before the ellipsis should end a word, not split one.
    expect(out.replace("…", "").endsWith("word")).toBe(true);
  });

  it("does not leave dangling punctuation before the ellipsis", () => {
    const out = metaDescription(`${"alpha, ".repeat(40)}omega`)!;
    expect(out).not.toMatch(/[,;:.\s]…$/);
  });

  it("returns undefined for nothing, so the key can be omitted entirely", () => {
    expect(metaDescription(undefined)).toBeUndefined();
    expect(metaDescription(null)).toBeUndefined();
    expect(metaDescription("   ")).toBeUndefined();
  });
});

describe("canonicalUrl", () => {
  it("returns the bare origin for the root, not a double slash", () => {
    // `https://site.com//` is a different URL to a crawler, which would split
    // the homepage's ranking between two addresses.
    expect(canonicalUrl(SITE, "/")).toBe(SITE);
    expect(canonicalUrl(`${SITE}/`, "/")).toBe(SITE);
  });

  it("joins a path onto the origin exactly once", () => {
    expect(canonicalUrl(SITE, "/style")).toBe(`${SITE}/style`);
    expect(canonicalUrl(`${SITE}/`, "/style")).toBe(`${SITE}/style`);
    expect(canonicalUrl(SITE, "style")).toBe(`${SITE}/style`);
  });
});

describe("productJsonLd", () => {
  const product = {
    name: "Field Jacket",
    slug: "field-jacket",
    blurb: "A jacket.",
    material: "Waxed cotton",
    pricePence: 14_500,
    availability: "in_stock" as const,
    images: ["/images/jacket.jpg"],
  };

  it("emits price as a bare decimal with the currency in its own field", () => {
    // The commonest way a product feed is rejected is a currency symbol inside
    // `price`. formatPence would give "£145.00"; schema.org wants "145.00".
    const ld = productJsonLd(SITE, product);
    const offers = ld.offers as Record<string, unknown>;

    expect(offers.price).toBe("145.00");
    expect(offers.priceCurrency).toBe("GBP");
    expect(String(offers.price)).not.toContain("£");
  });

  it("converts integer pence exactly, including the awkward ones", () => {
    const offers = (productJsonLd(SITE, { ...product, pricePence: 495 }).offers ?? {}) as Record<
      string,
      unknown
    >;
    expect(offers.price).toBe("4.95");
  });

  it("makes every URL absolute", () => {
    const ld = productJsonLd(SITE, product);
    const offers = ld.offers as Record<string, unknown>;

    expect(offers.url).toBe(`${SITE}/product/field-jacket`);
    expect(ld.image).toEqual([`${SITE}/images/jacket.jpg`]);
  });

  it("carries availability through from the product rather than assuming in stock", () => {
    const offers = (productJsonLd(SITE, { ...product, availability: "out_of_stock" }).offers ??
      {}) as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  /**
   * The four the CHECK in `0005_commerce.sql` allows, each to its own schema.org
   * term. This is the assertion that stops someone "simplifying" the map back to
   * a boolean: a preorder reported as OutOfStock tells a shopping feed the item
   * cannot be bought, when the whole point of a preorder is that it can.
   */
  it.each([
    ["in_stock", "https://schema.org/InStock"],
    ["out_of_stock", "https://schema.org/OutOfStock"],
    ["preorder", "https://schema.org/PreOrder"],
    ["discontinued", "https://schema.org/Discontinued"],
  ] as const)("maps %s to %s", (availability, expected) => {
    expect(schemaAvailability(availability)).toBe(expected);
  });

  it("covers every availability the database allows", () => {
    // If a migration adds a fifth value, `schemaAvailability`'s switch stops
    // being exhaustive and typecheck fails — but only if something imports the
    // list. This is that something.
    for (const availability of PRODUCT_AVAILABILITIES) {
      expect(schemaAvailability(availability)).toMatch(/^https:\/\/schema\.org\/\w+$/);
    }
  });

  it("omits material when there is none rather than emitting an empty claim", () => {
    expect(productJsonLd(SITE, { ...product, material: null })).not.toHaveProperty("material");
  });
});

describe("articleJsonLd", () => {
  it("builds an Article, not a NewsArticle", () => {
    // NewsArticle carries expectations about timeliness and corrections that an
    // editorial magazine does not meet.
    const ld = articleJsonLd(SITE, { title: "Speed, Considered", slug: "speed-considered" });

    expect(ld["@type"]).toBe("Article");
    expect(ld.url).toBe(`${SITE}/article/speed-considered`);
    expect(ld.publisher).toEqual({ "@type": "Organization", name: BRAND });
  });

  it("omits the optional fields it has no value for", () => {
    const ld = articleJsonLd(SITE, { title: "T", slug: "t" });

    expect(ld).not.toHaveProperty("author");
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("datePublished");
  });

  it("includes them when it does", () => {
    const ld = articleJsonLd(SITE, {
      title: "T",
      slug: "t",
      author: "A. Writer",
      image: "/images/hero.jpg",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(ld.author).toEqual({ "@type": "Person", name: "A. Writer" });
    expect(ld.image).toEqual([`${SITE}/images/hero.jpg`]);
    expect(ld.datePublished).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("organizationJsonLd", () => {
  it("points at the site root", () => {
    const ld = organizationJsonLd(SITE);
    expect(ld["@type"]).toBe("Organization");
    expect(ld.url).toBe(SITE);
    expect(ld.name).toBe(BRAND);
  });
});
