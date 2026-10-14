import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_SITE_ACCESS,
  lockedSiteAccess,
  resolveSiteAccess,
  showPublicChrome,
  siteAccessChangeSchema,
  staffCanBrowse,
  validateSiteAccessChange,
} from "./siteAccessState";

afterEach(() => vi.unstubAllEnvs());

describe("runtime site access and launch scheduling", () => {
  it("keeps the existing env fallback until an admin selects a mode", () => {
    vi.stubEnv("SITE_ACCESS_MODE", "public");
    expect(resolveSiteAccess(INITIAL_SITE_ACCESS, "stamp").effectiveMode).toBe("public");
    vi.stubEnv("SITE_ACCESS_MODE", undefined);
    expect(resolveSiteAccess(INITIAL_SITE_ACCESS, "stamp").effectiveMode).toBe("homepage-only");
  });

  it("is fail closed on damaged state or lookup failures", () => {
    vi.stubEnv("SITE_ACCESS_MODE", "public");
    expect(resolveSiteAccess({ mode: "incorrect" }, "stamp")).toEqual(lockedSiteAccess());
    expect(lockedSiteAccess().effectiveMode).toBe("homepage-only");
  });

  it("separates private staff chrome from visitor and homepage-only views", () => {
    expect(showPublicChrome("private-preview", false)).toBe(false);
    expect(showPublicChrome("private-preview", true)).toBe(true);
    expect(showPublicChrome("homepage-only", true)).toBe(false);
    expect(showPublicChrome("public", false)).toBe(true);
    expect(staffCanBrowse("homepage-only", false)).toBe(false);
    expect(staffCanBrowse("private-preview", true)).toBe(true);
  });

  it("enforces a scheduled launch at request time without a cron runner", () => {
    const stored = {
      mode: "private-preview",
      scheduledPublicAt: "2026-12-01T14:00:00.000Z",
      version: 3,
    };
    expect(resolveSiteAccess(stored, "stamp", new Date("2026-12-01T13:59:59Z")).effectiveMode).toBe(
      "private-preview"
    );
    expect(resolveSiteAccess(stored, "stamp", new Date("2026-12-01T14:00:00Z")).effectiveMode).toBe(
      "public"
    );
    expect(resolveSiteAccess(stored, "stamp", new Date("2026-12-02T14:00:00Z")).mode).toBe(
      "private-preview"
    );
  });

  it("rejects accidental publishing, past schedules and unrelated fields", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const normal = {
      mode: "public" as const,
      scheduledPublicAt: null,
      expectedUpdatedAt: "stamp",
      confirmation: "CONFIRM" as const,
    };
    expect(() => validateSiteAccessChange(normal, now)).toThrow("LAUNCH");
    expect(() =>
      validateSiteAccessChange(
        {
          ...normal,
          mode: "homepage-only",
          scheduledPublicAt: "2026-10-01T00:00:00Z",
          confirmation: "SCHEDULE",
        },
        now
      )
    ).toThrow("Schedule a launch");
    expect(
      siteAccessChangeSchema.safeParse({
        ...normal,
        overridePermission: true,
      }).success
    ).toBe(false);
  });
});
