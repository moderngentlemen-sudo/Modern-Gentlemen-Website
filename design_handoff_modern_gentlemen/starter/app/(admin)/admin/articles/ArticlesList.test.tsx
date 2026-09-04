import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArticlesList, type ArticleRow } from "./ArticlesList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./actions", () => ({
  createArticleAction: vi.fn(),
  deleteArticleAction: vi.fn(),
}));

const articles: ArticleRow[] = [
  {
    id: "article-1",
    title: "The Slow Car, Fast Philosophy",
    slug: "the-slow-car-fast-philosophy",
    status: "published",
    version: 3,
    updated_at: "2026-09-04T00:00:00.000Z",
  },
];

describe("ArticlesList search and pagination", () => {
  it("keeps the server search in the URL and preserves it across pages", () => {
    render(
      <ArticlesList
        articles={articles}
        search="slow cars"
        total={31}
        page={2}
        pageCount={3}
        canWrite={false}
        canDelete={false}
      />
    );

    expect(screen.getByRole("searchbox", { name: "Search articles" })).toHaveValue("slow cars");
    expect(screen.getByText("31 results for “slow cars”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/articles?q=slow+cars"
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/articles?q=slow+cars&page=3"
    );
  });

  it("distinguishes an empty search from an empty article library", () => {
    render(
      <ArticlesList
        articles={[]}
        search="missing title"
        total={0}
        page={1}
        pageCount={1}
        canWrite
        canDelete
      />
    );

    expect(screen.getByRole("heading", { name: "No matching articles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/admin/articles"
    );
    expect(screen.queryByText("No articles yet")).not.toBeInTheDocument();
  });
});
