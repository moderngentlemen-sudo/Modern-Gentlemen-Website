import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as RateLimit from "./rateLimit";

const { createClient, resolvePreviewFromRepository, consumeRateLimit } = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolvePreviewFromRepository: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient }));
vi.mock("@/lib/db/repositories/previewSessions", () => ({
  resolvePreview: resolvePreviewFromRepository,
}));
vi.mock("./auth", () => ({ requirePermission: vi.fn() }));
vi.mock("./rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  consumeRateLimit,
}));

import { resolvePreview } from "./preview";

describe("resolvePreview", () => {
  const resolved = {
    entityType: "page",
    entityId: "page-1",
    device: "desktop",
    expiresAt: "2030-01-01T00:00:00.000Z",
    data: { sections: [] },
  } as const;

  beforeEach(() => {
    createClient.mockReset().mockResolvedValue({ rpc: vi.fn() });
    resolvePreviewFromRepository.mockReset().mockResolvedValue(resolved);
    consumeRateLimit.mockReset().mockResolvedValue(true);
  });

  it("consumes caller and global limits before resolving the token", async () => {
    await expect(resolvePreview("secret-token", "203.0.113.9")).resolves.toEqual(resolved);

    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(consumeRateLimit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ scope: "preview", identity: "203.0.113.9" })
    );
    expect(consumeRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ scope: "preview", identity: "*" })
    );
    expect(resolvePreviewFromRepository).toHaveBeenCalledWith(expect.anything(), "secret-token");
  });

  it("consumes both buckets even when either one refuses", async () => {
    consumeRateLimit.mockResolvedValue(false);

    await expect(resolvePreview("secret-token", "203.0.113.9")).resolves.toBeNull();
    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(createClient).not.toHaveBeenCalled();
    expect(resolvePreviewFromRepository).not.toHaveBeenCalled();
  });

  it("uses only the global bucket when no proxy identity is available", async () => {
    await resolvePreview("secret-token", null);

    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "preview", identity: "*" })
    );
  });
});
