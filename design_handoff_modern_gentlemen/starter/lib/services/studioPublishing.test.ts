import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "./auth";
import { createClient } from "@/lib/db/server";
import { getDocument, getDocumentBySlug } from "./documents";
import { createPage } from "@/lib/db/repositories/pages";
import { saveStudioDraft } from "@/lib/db/repositories/studioDrafts";
import { saveStudioPage, loadStudioPage } from "./studioPublishing";
import { convertStudio } from "@/lib/blocks/studioPublishing";

vi.mock("./auth", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("./documents", () => ({
  getDocument: vi.fn(),
  getDocumentBySlug: vi.fn(),
  blockTreesOf: vi.fn(() => []),
}));
vi.mock("./media", () => ({ reconcileEntityMedia: vi.fn() }));
vi.mock("@/lib/db/repositories/pages", () => ({ createPage: vi.fn() }));
vi.mock("@/lib/db/repositories/studioDrafts", () => ({ saveStudioDraft: vi.fn() }));
function input() {
  const page = { page: "#ffffff", sections: [{ uid: "section-1", height: 400 }], nodes: [] };
  return {
    title: "Invitation",
    slug: "invitation",
    document: {
      version: 1,
      source: { ...page, layoutDevice: "desktop" },
      views: Object.fromEntries(
        ["desktop", "tablet", "mobile"].map((view) => [view, { ...page, layoutDevice: view }])
      ),
    },
  };
}
describe("Studio persistence boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({ id: "editor" } as never);
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(getDocumentBySlug).mockResolvedValue(null);
    vi.mocked(createPage).mockResolvedValue({ id: "created", updated_at: "now" } as never);
    vi.mocked(saveStudioDraft).mockResolvedValue("next");
  });
  it("refuses unauthorized saves before touching the database", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    await expect(saveStudioPage(input())).rejects.toThrow("denied");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("creates a draft with the complete active source and no published/status writes", async () => {
    const result = await saveStudioPage(input());
    expect(result.issues).toEqual([]);
    const created = vi.mocked(createPage).mock.calls[0][1];
    expect(created).not.toHaveProperty("status");
    expect(created).not.toHaveProperty("publishedData");
    expect(created.draftData).toHaveProperty("_designStudio.source");
    expect(requirePermission).toHaveBeenCalledWith("page.write");
  });
  it.each(["home", "shop", "admin", "about"])("protects the existing %s route", async (slug) => {
    await expect(saveStudioPage({ ...input(), slug })).rejects.toThrow("reserved");
    expect(createPage).not.toHaveBeenCalled();
  });
  it("does not replace an Original builder page", async () => {
    vi.mocked(getDocument).mockResolvedValue({ draft_data: { sections: [] } } as never);
    await expect(
      saveStudioPage({ ...input(), id: "e2d42f70-e3fb-4d15-b521-d40a2a4a9e16" })
    ).rejects.toThrow("Only a saved Design Studio");
    expect(saveStudioDraft).not.toHaveBeenCalled();
  });
  it("passes the caller's timestamp into the atomic conflict check", async () => {
    const id = "e2d42f70-e3fb-4d15-b521-d40a2a4a9e16";
    vi.mocked(getDocument).mockResolvedValue({
      id,
      title: "Invitation",
      slug: "invitation",
      draft_data: { _designStudio: input().document },
    } as never);
    await saveStudioPage({ ...input(), id, expectedUpdatedAt: "previous" });
    expect(saveStudioDraft).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id, expectedUpdatedAt: "previous", updatedBy: "editor" })
    );
  });
  it("requires resaving an older generated layout before it can be previewed", async () => {
    const id = "e2d42f70-e3fb-4d15-b521-d40a2a4a9e16",
      document = input().document;
    vi.mocked(getDocument).mockResolvedValue({
      id,
      title: "Invitation",
      slug: "invitation",
      updated_at: "now",
      draft_data: { _designStudio: document, sections: [] },
    } as never);
    expect((await loadStudioPage(id)).issues[0].message).toMatch(/Save to site again/);
    vi.mocked(getDocument).mockResolvedValue({
      id,
      title: "Invitation",
      slug: "invitation",
      updated_at: "now",
      draft_data: { _designStudio: document, sections: convertStudio(document).sections },
    } as never);
    expect((await loadStudioPage(id)).issues).toEqual([]);
  });
});
