import { describe, expect, it } from "vitest";

import { pathsFor, type PublishedOnSchedule } from "./scheduledJobs";

const row = (over: Partial<PublishedOnSchedule>): PublishedOnSchedule => ({
  entityType: "page",
  entityId: "00000000-0000-0000-0000-000000000000",
  version: 2,
  slug: "about",
  categorySlug: null,
  ...over,
});

/**
 * The runner has to invalidate the same paths a manual publish does. That rule
 * lives in two places now — `revalidatePublicArticle` for an editor's publish
 * and this for the scheduler's — and the interesting half is the second path:
 * a category listing is bound to the `articles` table, so publishing an article
 * changes a page nobody edited.
 */
describe("paths a scheduled publish invalidates", () => {
  it("gives a page its own path, with the homepage's slug mismatch handled", () => {
    expect(pathsFor(row({ slug: "about" }))).toEqual(["/about"]);
    // `pages.slug` is "home" and the site serves it at "/". Revalidating
    // "/home" would succeed, invalidate nothing, and leave the homepage stale.
    expect(pathsFor(row({ slug: "home" }))).toEqual(["/"]);
  });

  it("gives an article both its own path and its category's listing", () => {
    expect(
      pathsFor(row({ entityType: "article", slug: "speed-considered", categorySlug: "culture" }))
    ).toEqual(["/article/speed-considered", "/culture"]);
  });

  it("omits the category path for an unfiled article rather than inventing one", () => {
    // The twenty template showcases and the cover story are filed under
    // nothing, so there is no listing to invalidate.
    expect(pathsFor(row({ entityType: "article", slug: "speed-considered" }))).toEqual([
      "/article/speed-considered",
    ]);
  });

  it("returns nothing for a type with no public route", () => {
    // `product` is not schedulable today, so the runner should never see one —
    // but returning [] is the right answer if SCHEDULABLE_TYPES ever grows and
    // this file is not updated with it.
    expect(pathsFor(row({ entityType: "product", slug: "travel-watch-roll" }))).toEqual([]);
  });
});
