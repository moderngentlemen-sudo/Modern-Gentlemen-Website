import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), selection: vi.fn() }));
vi.mock("@/lib/db/public", () => ({ createPublicClient: mocks.client }));
vi.mock("@/lib/db/repositories/homepage", () => ({ getHomepagePageId: mocks.selection }));
import { getPublishedHomepage } from "./publicContent";
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.client.mockReturnValue({ from: () => query });
  mocks.selection.mockResolvedValue("selected-id");
  query.maybeSingle.mockResolvedValue({
    data: {
      id: "selected-id",
      slug: "launch",
      title: "Launch",
      published_data: { sections: [{ _key: "published" }], pageSettings: { noIndex: true } },
    },
    error: null,
  });
});
it("uses the selected id and only published data, including presentation settings", async () => {
  await expect(getPublishedHomepage()).resolves.toMatchObject({
    id: "selected-id",
    sections: [{ _key: "published" }],
    pageSettings: { noIndex: true },
  });
  expect(query.eq).toHaveBeenCalledWith("id", "selected-id");
  expect(query.eq).toHaveBeenCalledWith("status", "published");
  expect(query.select.mock.calls[0][0]).not.toContain("draft_data");
});
it("keeps the legacy home page when no selection has been made", async () => {
  mocks.selection.mockResolvedValue(null);
  await getPublishedHomepage();
  expect(query.eq).toHaveBeenCalledWith("slug", "home");
});
it("does not silently switch back when a configured page is missing", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(getPublishedHomepage()).resolves.toBeNull();
  expect(query.eq).not.toHaveBeenCalledWith("slug", "home");
});
it("surfaces database errors rather than serving demo or draft content", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  await expect(getPublishedHomepage()).rejects.toThrow("unavailable");
});
