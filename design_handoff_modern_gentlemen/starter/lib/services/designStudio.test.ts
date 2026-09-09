import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { supabaseUrl } from "@/lib/db/env";
import { requirePermission } from "./auth";
import { readDesignStudio } from "./designStudio";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const readFile = vi.fn();
  return { ...actual, readFile, default: { ...actual, readFile } };
});
vi.mock("./auth", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/env", () => ({ supabaseUrl: vi.fn() }));

describe("Design Studio asset boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(supabaseUrl).mockReturnValue("https://project.supabase.co");
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
  it.each(["https://project.supabase.co", "http://127.0.0.1:54321"])(
    "allows hosted media from %s in the bundled iframe policy",
    async (origin) => {
      const html = readFileSync("studio-assets/index.html", "utf8");
      vi.mocked(readFile).mockResolvedValue(Buffer.from(html));
      vi.mocked(supabaseUrl).mockReturnValue(origin);
      const result = await readDesignStudio("index.html");
      const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(
        String(result?.body)
      )![1];
      const directives = Object.fromEntries(
        policy.split(";").map((part) => {
          const [directive, ...sources] = part.trim().split(" ");
          return [directive, sources];
        })
      );
      expect(directives["img-src"]).toContain(origin);
      expect(directives["media-src"]).toContain(origin);
      expect(directives["script-src"]).not.toContain(origin);
      expect(directives["connect-src"]).toEqual(["blob:", "data:"]);
      expect(directives["object-src"]).toEqual(["'none'"]);
    }
  );
});
