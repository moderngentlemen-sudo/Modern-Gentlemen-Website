import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "./auth";
import { createClient } from "@/lib/db/server";
import { getDocument } from "./documents";
import { saveStudioDraft } from "@/lib/db/repositories/studioDrafts";
import { getThemeByKey, saveThemeDraftIfCurrent } from "@/lib/db/repositories/theme";
import {
  saveAppearancePage,
  saveAppearanceTheme,
  previewAppearancePage,
} from "./appearanceCustomizer";
import { DEFAULT_THEME_SETTINGS } from "@/lib/domain/theme";
vi.mock("./auth", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("./documents", () => ({ getDocument: vi.fn(), listDocuments: vi.fn() }));
vi.mock("./patterns", () => ({ expandPatternRefs: vi.fn(async (tree) => tree) }));
vi.mock("@/lib/db/repositories/studioDrafts", () => ({ saveStudioDraft: vi.fn() }));
vi.mock("@/lib/db/repositories/theme", () => ({
  getThemeByKey: vi.fn(),
  saveThemeDraftIfCurrent: vi.fn(),
}));
const id = "e2d42f70-e3fb-4d15-b521-d40a2a4a9e16";
describe("Appearance Studio permissions and persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({ id: "editor" } as never);
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(getDocument).mockResolvedValue({
      id,
      title: "Home",
      slug: "home",
      updated_at: "current",
      draft_data: { sections: [], pageSettings: { noIndex: true } },
    } as never);
    vi.mocked(saveStudioDraft).mockResolvedValue("next");
    vi.mocked(getThemeByKey).mockResolvedValue({ id: "theme", updated_at: "current" } as never);
    vi.mocked(saveThemeDraftIfCurrent).mockResolvedValue("next");
  });
  it("refuses writes before accessing the database when permission is missing", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    await expect(saveAppearancePage({})).rejects.toThrow("denied");
    await expect(saveAppearanceTheme({})).rejects.toThrow("denied");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("passes the opening timestamp to the atomic page writer and touches only the draft", async () => {
    const result = await saveAppearancePage({
      id,
      expectedUpdatedAt: "opening",
      changes: { page: { backgroundColor: "#123456" }, targets: [] },
    });
    expect(saveStudioDraft).toHaveBeenCalledWith(
      {},
      {
        id,
        expectedUpdatedAt: "opening",
        updatedBy: "editor",
        payload: { sections: [], pageSettings: { noIndex: true, backgroundColor: "#123456" } },
      }
    );
    expect(result.updatedAt).toBe("next");
  });
  it("passes the theme timestamp to its conditional writer", async () => {
    await saveAppearanceTheme({ expectedUpdatedAt: "opening", settings: DEFAULT_THEME_SETTINGS });
    expect(saveThemeDraftIfCurrent).toHaveBeenCalledWith(
      {},
      "theme",
      "opening",
      expect.objectContaining({ header: DEFAULT_THEME_SETTINGS.header })
    );
  });
  it("does not preview a draft that changed in another editor", async () => {
    await expect(
      previewAppearancePage({ id, expectedUpdatedAt: "old", changes: { targets: [] } })
    ).rejects.toThrow("another editor");
    expect(saveStudioDraft).not.toHaveBeenCalled();
  });
});
