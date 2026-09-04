import { describe, expect, it, vi } from "vitest";

import { articleMatchesFallbackSearch, listArticles } from "./articles";

const rows = [
  {
    id: "1",
    title: "The Slow Car, Fast Philosophy",
    subtitle: "Why less speed can mean more pleasure",
    excerpt: "A considered drive.",
    slug: "the-slow-car-fast-philosophy",
    status: "published",
    version: 1,
    published_at: null,
    scheduled_for: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    title: "A Better Shave",
    subtitle: null,
    excerpt: "The ritual, reconsidered.",
    slug: "a-better-shave",
    status: "draft",
    version: 1,
    published_at: null,
    scheduled_for: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

function query(result: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "textSearch"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

describe("article search migration compatibility", () => {
  it("matches title, metadata and hyphenated slug words without raw filter grammar", () => {
    expect(articleMatchesFallbackSearch(rows[0], "slow philosophy")).toBe(true);
    expect(articleMatchesFallbackSearch(rows[0], "more pleasure")).toBe(true);
    expect(articleMatchesFallbackSearch(rows[0], "slow-car")).toBe(true);
    expect(articleMatchesFallbackSearch(rows[0], "shaving")).toBe(false);
  });

  it("falls back to exact in-memory paging only when search_vector is missing", async () => {
    const primary = query({
      data: null,
      error: { code: "42703", message: "column articles.search_vector does not exist" },
    });
    const fallback = query({ data: rows, error: null });
    const db = { from: vi.fn().mockReturnValueOnce(primary).mockReturnValueOnce(fallback) };

    const result = await listArticles(db as never, {
      search: "slow philosophy",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.articles).toEqual([
      expect.objectContaining({ id: "1", slug: "the-slow-car-fast-philosophy" }),
    ]);
    expect(result.articles[0]).not.toHaveProperty("subtitle");
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("does not hide unrelated database failures", async () => {
    const primary = query({ data: null, error: { code: "42501", message: "permission denied" } });
    const db = { from: vi.fn(() => primary) };

    await expect(listArticles(db as never, { search: "slow" })).rejects.toThrow(
      "Could not list the articles: permission denied"
    );
    expect(db.from).toHaveBeenCalledTimes(1);
  });
});
