import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  client: vi.fn(),
  page: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.client }));
vi.mock("./auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/db/repositories/pages", () => ({ getPage: mocks.page }));
vi.mock("@/lib/db/repositories/homepage", () => ({ setHomepagePageId: mocks.set }));
import { setHomepage } from "./homepage";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({ session: true });
  mocks.page.mockResolvedValue({ status: "published", published_data: { sections: [] } });
});
it("requires publication and editing rights before touching storage", async () => {
  mocks.permission.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(setHomepage("page-id")).rejects.toThrow("Forbidden");
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it.each(["draft", "scheduled", "archived"])(
  "refuses a %s page without changing the selection",
  async (status) => {
    mocks.page.mockResolvedValue({ status, published_data: { sections: [] } });
    await expect(setHomepage("page-id")).rejects.toThrow("Publish this page");
    expect(mocks.set).not.toHaveBeenCalled();
  }
);
it("refuses missing published content or an absent page", async () => {
  mocks.page.mockResolvedValue({ status: "published", published_data: null });
  await expect(setHomepage("page-id")).rejects.toThrow("Publish this page");
  mocks.page.mockResolvedValue(null);
  await expect(setHomepage("page-id")).rejects.toThrow("Page not found");
});
it("selects the published page through the caller's session", async () => {
  await setHomepage("page-id");
  expect(mocks.permission.mock.calls).toEqual([["page.publish"], ["page.write"]]);
  expect(mocks.set).toHaveBeenCalledWith({ session: true }, "page-id");
});
