import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listPages: vi.fn(),
  getCategory: vi.fn(),
  getPage: vi.fn(),
  composeCategory: vi.fn(),
  composePage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/SectionRenderer", () => ({
  SectionRenderer: ({ sections }: { sections: Array<{ key: string }> }) => (
    <div data-testid="sections">{sections.map((section) => section.key).join(",")}</div>
  ),
}));

vi.mock("@/lib/db/env", () => ({ canonicalSiteUrl: () => "https://example.com" }));

vi.mock("@/lib/services/publicEditorial", () => ({
  listPublishedCategorySlugs: mocks.listCategories,
  getPublishedCategory: mocks.getCategory,
}));

vi.mock("@/lib/services/publicContent", () => ({
  listPublishedPageSlugs: mocks.listPages,
  getPublishedPage: mocks.getPage,
  composePublishedCategory: mocks.composeCategory,
  composePublishedPage: mocks.composePage,
}));

import RootSlugPage, { generateMetadata, generateStaticParams } from "./page";

const params = (slug: string) => Promise.resolve({ category: slug });

describe("the shared root-slug route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([]);
    mocks.listPages.mockResolvedValue([]);
    mocks.getCategory.mockResolvedValue(null);
    mocks.getPage.mockResolvedValue(null);
    mocks.composeCategory.mockResolvedValue([{ key: "category" }]);
    mocks.composePage.mockResolvedValue([{ key: "page" }]);
  });

  it("pre-renders both category and ordinary page slugs without duplicates", async () => {
    mocks.listCategories.mockResolvedValue(["style", "culture"]);
    mocks.listPages.mockResolvedValue(["culture", "contact"]);

    await expect(generateStaticParams()).resolves.toEqual([
      { category: "style" },
      { category: "culture" },
      { category: "contact" },
    ]);
  });

  it("serves a published builder page when the slug is not a category", async () => {
    const page = { id: "page-id", slug: "contact", title: "Contact", sections: [] };
    mocks.getPage.mockResolvedValue(page);

    render(await RootSlugPage({ params: params("CONTACT") }));

    expect(mocks.getPage).toHaveBeenCalledWith("contact");
    expect(mocks.composePage).toHaveBeenCalledWith(page);
    expect(screen.getByTestId("sections")).toHaveTextContent("page");

    await expect(generateMetadata({ params: params("contact") })).resolves.toMatchObject({
      title: "Contact — Modern Gentlemen",
      alternates: { canonical: "https://example.com/contact" },
    });
  });

  it("keeps editorial category precedence when both tables use a slug", async () => {
    const category = {
      id: "category-id",
      slug: "style",
      name: "Style",
      intro: "Considered style.",
      sections: [],
    };
    mocks.getCategory.mockResolvedValue(category);

    render(await RootSlugPage({ params: params("style") }));

    expect(mocks.getPage).not.toHaveBeenCalled();
    expect(mocks.composeCategory).toHaveBeenCalled();
    expect(screen.getByTestId("sections")).toHaveTextContent("category");
  });

  it("returns not found when neither kind is published", async () => {
    await expect(RootSlugPage({ params: params("missing") })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
