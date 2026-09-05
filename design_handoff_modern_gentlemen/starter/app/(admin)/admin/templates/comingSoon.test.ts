import { beforeEach, expect, it, vi } from "vitest";
import { createTemplateAction } from "./actions";
import { createPageAction } from "../pages/actions";
const calls = vi.hoisted(() => ({ template: vi.fn(), page: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/templates", () => ({ createTemplate: calls.template }));
vi.mock("@/lib/services/documents", () => ({ createPage: calls.page }));
beforeEach(() => {
  vi.clearAllMocks();
  calls.template.mockResolvedValue({ id: "template-id" });
  calls.page.mockResolvedValue({ id: "page-id" });
});
it("builds only the allowlisted starter tree on the server", async () => {
  await createTemplateAction({
    name: "Launch",
    key: "launch",
    kind: "page",
    comingSoon: "06",
    areas: { main: [] },
  });
  expect(calls.template).toHaveBeenCalledWith(
    expect.objectContaining({
      areas: {
        main: [
          expect.objectContaining({
            _type: "comingSoonStudio",
            settings: expect.objectContaining({ variant: "06" }),
          }),
          expect.objectContaining({ _type: "documentContent" }),
        ],
      },
    })
  );
});
it("rejects coming-soon templates of incompatible kinds without a write", async () => {
  expect(
    (
      await createTemplateAction({
        name: "Launch",
        key: "launch",
        kind: "article",
        comingSoon: "01",
      })
    ).ok
  ).toBe(false);
  expect(calls.template).not.toHaveBeenCalled();
});
it("rejects unknown designs for both creation actions", async () => {
  expect(
    (await createTemplateAction({ name: "Launch", key: "launch", kind: "page", comingSoon: "99" }))
      .ok
  ).toBe(false);
  expect((await createPageAction({ title: "Launch", slug: "launch", comingSoon: "99" })).ok).toBe(
    false
  );
  expect(calls.page).not.toHaveBeenCalled();
  expect(calls.template).not.toHaveBeenCalled();
});
it("passes a selected page design through to authorized page creation", async () => {
  expect((await createPageAction({ title: "Launch", slug: "launch", comingSoon: "20" })).ok).toBe(
    true
  );
  expect(calls.page).toHaveBeenCalledWith({ title: "Launch", slug: "launch", comingSoon: "20" });
});
it("preserves ordinary blank template creation", async () => {
  await createTemplateAction({ name: "Editorial", key: "editorial", kind: "page" });
  expect(calls.template).toHaveBeenCalledWith({
    name: "Editorial",
    key: "editorial",
    kind: "page",
  });
});
