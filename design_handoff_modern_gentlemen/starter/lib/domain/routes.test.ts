import { describe, expect, it } from "vitest";

import { DOCUMENT_TYPES } from "./documents";
import {
  ADMIN_SEGMENT,
  DOCUMENT_NOUN,
  adminPathForDocument,
  HOME_PAGE_SLUG,
  publicPathForArticle,
  publicPathForCategory,
  publicPathForDocument,
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

describe("publicPathForDocument", () => {
  it("gives the public URL for the four types that have one", () => {
    expect(publicPathForDocument("page", "home")).toBe("/");
    expect(publicPathForDocument("page", "about")).toBe("/about");
    expect(publicPathForDocument("article", "speed-considered")).toBe("/article/speed-considered");
    expect(publicPathForDocument("category", "style")).toBe("/style");
    expect(publicPathForDocument("product", "travel-watch-roll")).toBe(
      "/product/travel-watch-roll"
    );
  });

  it("returns null for a template and a pattern, which have no URL at all", () => {
    // The defect this closes: the publish dialog printed `/{slug}` regardless,
    // so publishing a pattern advertised a page that has never existed.
    expect(publicPathForDocument("template", "editorial-frame")).toBeNull();
    expect(publicPathForDocument("pattern", "editorial-trio")).toBeNull();
  });

  it("answers for every document type, so a new one cannot be forgotten", () => {
    // `publicPathForDocument` switches exhaustively and `DOCUMENT_NOUN` is
    // `satisfies Record<DocumentType, string>`, so both fail at compile time —
    // this is the runtime half, and it also proves no noun is blank.
    for (const type of DOCUMENT_TYPES) {
      expect(() => publicPathForDocument(type, "a-slug")).not.toThrow();
      expect(DOCUMENT_NOUN[type].length).toBeGreaterThan(0);
    }
  });
});
