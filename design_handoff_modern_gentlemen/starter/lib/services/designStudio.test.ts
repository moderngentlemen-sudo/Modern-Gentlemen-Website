import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { requirePermission } from "./auth";
import { readDesignStudio } from "./designStudio";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const readFile = vi.fn();
  return { ...actual, readFile, default: { ...actual, readFile } };
});
vi.mock("./auth", () => ({ requirePermission: vi.fn() }));

describe("Design Studio asset boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({ id: "editor-a" } as Awaited<
      ReturnType<typeof requirePermission>
    >);
  });
  it("checks page.write before reading any asset", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    await expect(readDesignStudio("index.html")).rejects.toThrow("denied");
    expect(requirePermission).toHaveBeenCalledWith("page.write");
    expect(readFile).not.toHaveBeenCalled();
  });
  it("rejects paths outside the exact asset allowlist", async () => {
    expect(await readDesignStudio("../../.env.local")).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });
  it("scopes draft keys to the authenticated editor", async () => {
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from('localStorage.getItem("mg-builder-drafts-v1")')
    );
    const result = await readDesignStudio("index.html");
    expect(result?.body).toContain("mg-builder-editor-a-drafts-v1");
    expect(result?.contentType).toBe("text/html; charset=utf-8");
  });
});
