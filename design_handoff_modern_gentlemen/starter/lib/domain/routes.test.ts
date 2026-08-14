import { describe, expect, it } from "vitest";

import { DOCUMENT_TYPES } from "./documents";
import {
  ADMIN_SEGMENT,
  adminPathForDocument,
  HOME_PAGE_SLUG,
  publicPathForArticle,
  publicPathForCategory,
  publicPathForPage,
} from "./routes";

describe("publicPathForPage", () => {
  it("maps the home slug to the site root, not to /home", () => {
    // The whole reason this helper exists. `revalidatePath("/home")` would
    // succeed, revalidate nothing, and leave the homepage stale after a
    // publish — a failure with no error message anywhere.
    expect(publicPathForPage(HOME_PAGE_SLUG)).toBe("/");
    expect(HOME_PAGE_SLUG).toBe("home");
  });

  it("maps any other slug to its own top-level path", () => {
    expect(publicPathForPage("about")).toBe("/about");
  });
});

describe("publicPathForArticle", () => {
  it("nests under /article", () => {
    expect(publicPathForArticle("speed-considered")).toBe("/article/speed-considered");
  });
});

describe("publicPathForCategory", () => {
  it("sits at the root, one segment deep", () => {
    // Not `/category/style` — the route is `app/(site)/[category]`, and a
    // revalidation of the wrong path is the silent failure this file prevents.
    expect(publicPathForCategory("style")).toBe("/style");
  });
});

describe("adminPathForDocument", () => {
  it("sends a pattern to /admin/patterns, not to the page route", () => {
    // The defect this replaced: `PublishBar` hard-coded `/admin/pages/${id}`,
    // so the shared builder's History button 404'd for the first document type
    // that was not a page.
    expect(adminPathForDocument("pattern", "abc")).toBe("/admin/patterns/abc");
    expect(adminPathForDocument("page", "abc")).toBe("/admin/pages/abc");
  });

  it("covers every document type", () => {
    // `satisfies Record<DocumentType, string>` already enforces this at compile
    // time; asserting it too means adding a sixth document type fails loudly
    // here rather than producing an `/admin/undefined/...` link at run time.
    for (const type of DOCUMENT_TYPES) {
      expect(ADMIN_SEGMENT[type], `no admin segment for ${type}`).toBeTruthy();
    }
  });
});
