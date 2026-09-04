import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const { searchPublishedArticles } = vi.hoisted(() => ({ searchPublishedArticles: vi.fn() }));
vi.mock("@/lib/services/publicEditorial", () => ({ searchPublishedArticles }));

beforeEach(() => searchPublishedArticles.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("GET /api/search/articles", () => {
  it("returns published service results with shared-cache guidance", async () => {
    searchPublishedArticles.mockResolvedValue([
      {
        tag: "Style",
        title: "Building a Wardrobe of Ten Things",
        meta: "6 MIN",
        href: "/article/building-a-wardrobe-of-ten-things",
        img: "/images/style-mono.jpg",
      },
    ]);

    const response = await GET(
      new NextRequest("https://example.test/api/search/articles?q=wardrobe%20ten")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      results: [expect.objectContaining({ title: "Building a Wardrobe of Ten Things" })],
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    expect(searchPublishedArticles).toHaveBeenCalledWith("wardrobe ten");
  });

  it("does not query for an empty term and rejects oversized input", async () => {
    expect(
      await (await GET(new NextRequest("https://example.test/api/search/articles?q=%20"))).json()
    ).toEqual({ results: [] });

    const response = await GET(
      new NextRequest(`https://example.test/api/search/articles?q=${"a".repeat(101)}`)
    );
    expect(response.status).toBe(400);
    expect(searchPublishedArticles).not.toHaveBeenCalled();
  });

  it("returns a non-sensitive unavailable response when the read fails", async () => {
    searchPublishedArticles.mockImplementationOnce(() => {
      throw new Error("database details");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new NextRequest("https://example.test/api/search/articles?q=style"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ results: [], reason: "unavailable" });
    expect(consoleError).toHaveBeenCalled();
  });
});
