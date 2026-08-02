import { describe, expect, it } from "vitest";

import { HOME_PAGE_SLUG, publicPathForArticle, publicPathForPage } from "./routes";

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
