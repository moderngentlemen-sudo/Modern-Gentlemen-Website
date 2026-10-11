import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ homepage: vi.fn(), compose: vi.fn() }));
vi.mock("@/lib/services/publicContent", () => ({
  getPublishedHomepage: mocks.homepage,
  composePublishedPage: mocks.compose,
}));
vi.mock("@/lib/db/env", () => ({ canonicalSiteUrl: () => "https://example.com" }));
vi.mock("@/components/SectionRenderer", () => ({
  SectionRenderer: ({ sections }: { sections: { text: string }[] }) => (
    <div>{sections.map((item) => item.text).join(",")}</div>
  ),
}));
import HomePage, { generateMetadata } from "./page";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.homepage.mockResolvedValue({
    id: "launch-id",
    slug: "launch",
    title: "Launch",
    sections: [],
    pageSettings: { seoTitle: "New front page", noIndex: true },
  });
  mocks.compose.mockResolvedValue([{ text: "Selected page content" }]);
});
it("renders and composes the selected published page at the root", async () => {
  render(await HomePage());
  expect(screen.getByText("Selected page content")).toBeVisible();
  expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({ id: "launch-id" }));
});
it("uses the selected page's SEO settings with the root canonical", async () => {
  await expect(generateMetadata()).resolves.toMatchObject({
    title: "New front page — Modern Gentlemen",
    alternates: { canonical: "https://example.com" },
    robots: { index: false, follow: true },
  });
});
it("fails loudly when the configured homepage is not published", async () => {
  mocks.homepage.mockResolvedValue(null);
  await expect(HomePage()).rejects.toThrow("No published homepage");
  expect(mocks.compose).not.toHaveBeenCalled();
});
