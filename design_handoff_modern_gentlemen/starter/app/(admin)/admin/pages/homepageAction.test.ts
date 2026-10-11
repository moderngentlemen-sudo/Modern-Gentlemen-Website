import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/services/homepage", () => ({ setHomepage: mocks.set }));
import { setHomepageAction } from "./actions";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => vi.resetAllMocks());
it("rejects malformed input before any write", async () => {
  expect(await setHomepageAction({ id: "/launch" })).toMatchObject({ ok: false });
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("updates the selection and invalidates public routes, the sitemap and the page list", async () => {
  expect(await setHomepageAction({ id })).toMatchObject({ ok: true });
  expect(mocks.set).toHaveBeenCalledWith(id);
  expect(mocks.revalidate.mock.calls).toEqual([
    ["/", "layout"],
    ["/admin/pages"],
    ["/sitemap.xml"],
  ]);
});
it("returns a failed selection without invalidating the existing homepage", async () => {
  mocks.set.mockRejectedValue(new Error("Publish this page before setting it as the homepage."));
  expect(await setHomepageAction({ id })).toMatchObject({
    ok: false,
    error: expect.stringContaining("Publish this page"),
  });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
