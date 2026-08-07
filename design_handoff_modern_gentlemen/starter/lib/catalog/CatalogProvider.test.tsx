import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogProvider, groups, makeCatalog, useCatalog } from "./CatalogProvider";
import { allProducts } from "@/lib/demo/catalog";
import type { Product } from "@/lib/cart/types";

/**
 * These helpers were lifted out of `lib/catalog.ts` when the store moved onto
 * the database, and the risk in a lift is that something changes on the way —
 * a filter that used to compare `cat` starts comparing `catLabel`, a `related`
 * that used to put same-category products first stops doing so. The PDP's
 * "You might also like" row is pixel-baselined against that ordering.
 *
 * So the fixture is the demo catalog itself: the same 16 products the seed
 * writes, exercised through the same helpers the pages now call.
 */
const products = allProducts();
const catalog = makeCatalog(products);

describe("makeCatalog", () => {
  it("returns every product, and a copy rather than the array itself", () => {
    expect(catalog.allProducts()).toHaveLength(16);
    expect(catalog.allProducts()).toEqual(products);
    // A caller sorting the result must not reorder the catalogue for everyone.
    expect(catalog.allProducts()).not.toBe(products);
  });

  it("finds a product by slug and returns null for one that does not exist", () => {
    expect(catalog.getProduct("travel-watch-roll")?.name).toBe("Travel Watch Roll, Waxed Canvas");
    // `the-driving-glove` is the slug the visual suite uses for the PDP's
    // not-found screen; it must keep not existing.
    expect(catalog.getProduct("the-driving-glove")).toBeNull();
  });

  it("filters by category, and treats All as no filter", () => {
    const watches = catalog.byGroup("Watches");
    expect(watches).toHaveLength(3);
    expect(watches.every((p) => p.cat === "Watches")).toBe(true);
    expect(catalog.byGroup("All")).toHaveLength(16);
  });

  it("puts same-category products first in the related row", () => {
    const related = catalog.related("travel-watch-roll", 4);

    expect(related).toHaveLength(4);
    // Never the product you are already looking at.
    expect(related.map((p) => p.slug)).not.toContain("travel-watch-roll");
    // The other two Watches lead, then everything else.
    expect(related.slice(0, 2).every((p) => p.cat === "Watches")).toBe(true);
    expect(related[2].cat).not.toBe("Watches");
  });

  it("falls back to the first n products for an unknown slug", () => {
    expect(catalog.related("nothing-here", 3)).toEqual(products.slice(0, 3));
  });

  it("copes with an empty catalogue", () => {
    // Not hypothetical: a database with nothing published yet returns [], and
    // the header's bag drawer still renders on every route.
    const empty = makeCatalog([] as Product[]);
    expect(empty.allProducts()).toEqual([]);
    expect(empty.getProduct("travel-watch-roll")).toBeNull();
    expect(empty.related("travel-watch-roll")).toEqual([]);
  });
});

describe("groups", () => {
  it("is the editorial chip order, not something derived from the rows", () => {
    expect(groups).toEqual(["All", "Style", "Watches", "Grooming", "Accessories"]);
  });
});

describe("useCatalog", () => {
  function Name() {
    const { getProduct } = useCatalog();
    return <span>{getProduct("field-chronometer")?.name ?? "none"}</span>;
  }

  it("serves the products the provider was given", () => {
    render(
      <CatalogProvider products={products}>
        <Name />
      </CatalogProvider>
    );
    expect(screen.getByText("MG Field Chronometer, 38mm")).toBeInTheDocument();
  });

  it("throws outside a provider rather than silently emptying the store", () => {
    // Mirrors useCart. A component rendered outside the site layout would
    // otherwise show an empty shop and no error anywhere.
    expect(() => render(<Name />)).toThrow(/must be used within <CatalogProvider>/);
  });
});
