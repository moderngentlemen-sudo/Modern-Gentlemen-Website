import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_IDENTITY,
  readSiteIdentity,
  safeIdentityImageUrl,
  siteIdentityMetadata,
  siteIdentitySchema,
} from "./siteIdentity";

describe("site identity", () => {
  it("preserves the original MG brand for old themes", () => {
    expect(readSiteIdentity(null)).toEqual(DEFAULT_SITE_IDENTITY);
    expect(siteIdentityMetadata(readSiteIdentity(undefined)).icons.icon[0].url).toBe("/site-icon.svg");
  });

  it("allows a library asset, safe external HTTPS and site-local icon", () => {
    expect(safeIdentityImageUrl("/site-icon.svg")).toBe(true);
    expect(safeIdentityImageUrl("/images/favicon.webp")).toBe(true);
    expect(safeIdentityImageUrl("https://example.supabase.co/storage/v1/object/public/media/mg.png")).toBe(true);
    expect(siteIdentitySchema.safeParse({
      ...DEFAULT_SITE_IDENTITY,
      faviconUrl: "https://example.supabase.co/favicon.png",
    }).success).toBe(true);
  });

  it("rejects executable, protocol-relative and credentialed icon destinations", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "//attacker.example/icon.svg",
      "/\\evil",
      "https://user:pass@example.com/a.png",
      "https://example.com/a.png\n",
      "http://example.com/a.png",
    ]) {
      expect(safeIdentityImageUrl(value), value).toBe(false);
      expect(siteIdentitySchema.safeParse({ ...DEFAULT_SITE_IDENTITY, faviconUrl: value }).success).toBe(false);
    }
  });

  it("recovers valid values independently from malformed legacy records", () => {
    const result = readSiteIdentity({
      siteName: "MG Journal",
      description: "New description",
      faviconUrl: "javascript:alert(1)",
      appleTouchIconUrl: "/apple-touch-icon.png",
    });
    expect(result).toEqual({
      ...DEFAULT_SITE_IDENTITY,
      siteName: "MG Journal",
      description: "New description",
      appleTouchIconUrl: "/apple-touch-icon.png",
    });
  });

  it("emits metadata for published icons and never invents an Apple image", () => {
    const identity = { ...DEFAULT_SITE_IDENTITY, faviconUrl: "/selected.png", appleTouchIconUrl: "/touch.png" };
    const meta = siteIdentityMetadata(identity);
    expect(meta.icons.icon).toEqual([{ url: "/selected.png" }]);
    expect(meta.icons.apple).toEqual([{ url: "/touch.png" }]);
    expect(siteIdentityMetadata(DEFAULT_SITE_IDENTITY).icons.apple).toBeUndefined();
  });
});
