import { afterEach, describe, expect, it } from "vitest";

import {
  isAdminPath,
  isAllowedWithoutStaff,
  isApiPath,
  isHomepageOnlyMode,
} from "./siteAccess";

const originalMode = process.env.SITE_ACCESS_MODE;
afterEach(() => {
  if (originalMode === undefined) delete process.env.SITE_ACCESS_MODE;
  else process.env.SITE_ACCESS_MODE = originalMode;
});

describe("homepage-only launch gate", () => {
  it("fails closed unless full public access is explicitly enabled", () => {
    delete process.env.SITE_ACCESS_MODE;
    expect(isHomepageOnlyMode()).toBe(true);
    process.env.SITE_ACCESS_MODE = "unexpected";
    expect(isHomepageOnlyMode()).toBe(true);
    process.env.SITE_ACCESS_MODE = "homepage-only";
    expect(isHomepageOnlyMode()).toBe(true);
    process.env.SITE_ACCESS_MODE = "public";
    expect(isHomepageOnlyMode()).toBe(false);
  });

  it("keeps only the homepage and the admin authentication flow public", () => {
    for (const path of [
      "/",
      "/sign-in",
      "/forgot-password",
      "/auth/callback",
      "/auth/sign-out",
      "/sitemap.xml",
      "/robots.txt",
      "/api/newsletter",
      "/api/forms",
      "/api/jobs/publish-scheduled",
      "/api/jobs/run-imports",
    ]) {
      expect(isAllowedWithoutStaff(path), path).toBe(true);
    }
  });

  it("blocks deep links, drafts, API search and near-miss prefixes", () => {
    for (const path of [
      "/about",
      "/shop",
      "/articles",
      "/article/a",
      "/style",
      "/preview/token",
      "/admin",
      "/admin/pages",
      "/administrator",
      "/sign-in/other",
      "/api",
      "/api/search/articles",
      "/api/admin/design-studio",
      "/api/jobs/unknown",
      "/api/newsletter/other",
    ]) {
      expect(isAllowedWithoutStaff(path), path).toBe(false);
    }
  });

  it("does not confuse admin and API prefixes and accepts trailing slashes", () => {
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/pages")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isApiPath("/api/search/articles")).toBe(true);
    expect(isApiPath("/apikey")).toBe(false);
    expect(isAllowedWithoutStaff("/sign-in/")).toBe(true);
  });
});
