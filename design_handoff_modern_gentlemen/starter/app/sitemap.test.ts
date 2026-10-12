import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ homepage: vi.fn(), pages: vi.fn(), noIndex: vi.fn() }));
vi.mock("@/lib/db/env", () => ({ canonicalSiteUrl: () => "https://example.com" }));
vi.mock("@/lib/services/publicContent", () => ({
  getPublishedHomepage: mocks.homepage,
  listPublishedPageSlugs: mocks.pages,
  listNoIndexPageSlugs: mocks.noIndex,
}));
vi.mock("@/lib/services/publicCatalog", () => ({ listPublishedProducts: async () => [] }));
vi.mock("@/lib/services/publicEditorial", () => ({
  listPublishedArticleSlugs: async () => [],
  listPublishedCategorySlugs: async () => [],
}));
import sitemap from "./sitemap";
beforeEach(() => {
  vi.stubEnv("SITE_ACCESS_MODE", "public");
  vi.resetAllMocks();
  mocks.homepage.mockResolvedValue({ slug: "launch" });
  mocks.pages.mockResolvedValue(["home", "contact"]);
  mocks.noIndex.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

it("advertises only the homepage in prelaunch mode", async () => {
  vi.stubEnv("SITE_ACCESS_MODE", "homepage-only");
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls).toEqual(["https://example.com"]);
  expect(mocks.homepage).not.toHaveBeenCalled();
  expect(mocks.pages).not.toHaveBeenCalled();
});

it("keeps a single root URL and gives the previous home page its own URL", async () => {
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls.filter((url) => url === "https://example.com")).toHaveLength(1);
  expect(urls).toContain("https://example.com/home");
  expect(urls).not.toContain("https://example.com/launch");
  expect(mocks.pages).toHaveBeenCalledWith("launch");
});
it("respects the selected homepage's no-index setting at the root", async () => {
  mocks.noIndex.mockResolvedValue(["launch"]);
  expect((await sitemap()).map((entry) => entry.url)).not.toContain("https://example.com");
});
it("does not transfer the previous homepage's no-index setting to its replacement", async () => {
  mocks.noIndex.mockResolvedValue(["home"]);
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls).toContain("https://example.com");
  expect(urls).not.toContain("https://example.com/home");
});
