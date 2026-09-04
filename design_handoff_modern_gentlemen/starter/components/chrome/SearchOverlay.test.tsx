import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { products as demoProducts } from "@/lib/demo/catalog";

import { SearchOverlay } from "./SearchOverlay";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.unstubAllGlobals();
});

const editorial = [
  {
    tag: "Motoring",
    title: "The Slow Car, Fast Philosophy",
    meta: "12 MIN",
    href: "/article/the-slow-car-fast-philosophy",
    img: "/images/hero-cover.jpg",
  },
  {
    tag: "Style",
    title: "A Wardrobe of Ten Things",
    meta: "7 MIN",
    href: "/article/a-wardrobe-of-ten-things",
    img: "/images/style-mono.jpg",
  },
];

function renderSearch(products = demoProducts) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "https://example.test");
      const query = url.searchParams.get("q") ?? "";
      const results = editorial.filter((entry) =>
        query.includes("wardrobe") ? entry.title.includes("Wardrobe") : entry.title.includes("Slow")
      );
      return { ok: true, json: async () => ({ results }) };
    })
  );
  return render(
    <CatalogProvider products={products}>
      <SearchOverlay open onClose={vi.fn()} />
    </CatalogProvider>
  );
}

describe("SearchOverlay published index", () => {
  it("finds article terms across intervening title words and metadata", async () => {
    renderSearch();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search editorial and store" }),
      "slow philosophy"
    );

    expect(
      await screen.findByRole("link", { name: /The Slow Car, Fast Philosophy/ })
    ).toHaveAttribute("href", "/article/the-slow-car-fast-philosophy");
    expect(screen.getByText("1 RESULT")).toBeInTheDocument();
  });

  it("searches every supplied published article rather than a prototype allowlist", async () => {
    renderSearch();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search editorial and store" }),
      "wardrobe"
    );

    expect(
      await screen.findByRole("link", { name: /A Wardrobe of Ten Things/ })
    ).toBeInTheDocument();
  });

  it("does not truncate matching store results at eight", async () => {
    const products = Array.from({ length: 9 }, (_, index) => ({
      ...demoProducts[0],
      slug: `search-match-${index + 1}`,
      name: `Search Match ${index + 1}`,
    }));
    renderSearch(products);

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search editorial and store" }),
      "search match"
    );

    expect(screen.getByText("9 RESULTS")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Search Match/ })).toHaveLength(9);
  });

  it("retains prototype-only film and membership destinations", async () => {
    renderSearch([]);

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search editorial and store" }),
      "weekly newsletter"
    );

    expect(screen.getByRole("link", { name: /The Debrief — Weekly Newsletter/ })).toHaveAttribute(
      "href",
      "/membership"
    );
  });
});
