import { beforeEach, expect, it, vi } from "vitest";
import { createPage } from "./documents";
import { createTemplate } from "./templates";
import { comingSoonTemplateAreas } from "@/lib/blocks/comingSoon";
import { AFTER_HOURS_PHOTO } from "@/lib/blocks/afterHours";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  page: vi.fn(),
  template: vi.fn(),
  media: vi.fn(),
  db: {},
}));
vi.mock("./auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn(async () => mocks.db) }));
vi.mock("@/lib/db/repositories/pages", () => ({
  createPage: mocks.page,
  EMPTY_PAGE_PAYLOAD: { sections: [], seo: {} },
}));
vi.mock("@/lib/db/repositories/templates", () => ({ createTemplate: mocks.template }));
vi.mock("./media", () => ({ reconcileEntityMedia: mocks.media, clearEntityMedia: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ id: "editor" });
  mocks.page.mockImplementation(async (_db, input) => ({
    id: "page",
    draft_data: input.draftData,
  }));
  mocks.template.mockResolvedValue({ id: "template" });
  mocks.media.mockResolvedValue(undefined);
});
it("tracks the starting photograph immediately on a new After Hours draft", async () => {
  await createPage({ title: "Launch", slug: "launch", comingSoon: "21" });
  expect(mocks.permission).toHaveBeenCalledWith("page.write");
  expect(mocks.page).toHaveBeenCalledWith(
    mocks.db,
    expect.objectContaining({ createdBy: "editor" })
  );
  expect(mocks.media).toHaveBeenCalledWith("page", "page", [
    {
      path: "sections",
      tree: [
        expect.objectContaining({
          settings: expect.objectContaining({ image: AFTER_HOURS_PHOTO }),
        }),
      ],
    },
  ]);
});
it("tracks starter media in a template's named areas", async () => {
  const areas = comingSoonTemplateAreas("21");
  await createTemplate({ name: "Launch", key: "launch", kind: "page", areas });
  expect(mocks.permission).toHaveBeenCalledWith("template.write");
  expect(mocks.media).toHaveBeenCalledWith("template", "template", [
    { path: "areas.main", tree: areas.main },
  ]);
});
