import { describe, expect, it } from "vitest";

import {
  bearerToken,
  JOB_RUN_STATUSES,
  pathsToRevalidate,
  PUBLISH_SCHEDULED_JOB,
  secretMatches,
  type PublishedOnSchedule,
} from "./jobs";

const published = (over: Partial<PublishedOnSchedule>): PublishedOnSchedule => ({
  entityType: "article",
  entityId: "id",
  slug: "slug",
  categorySlug: null,
  version: 2,
  ...over,
});

describe("secretMatches", () => {
  it("accepts the exact secret and nothing else", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    expect(secretMatches("s3cret ", "s3cret")).toBe(false);
    expect(secretMatches("S3cret", "s3cret")).toBe(false);
    expect(secretMatches("s3cre", "s3cret")).toBe(false);
    expect(secretMatches("s3cretx", "s3cret")).toBe(false);
  });

  it("refuses a missing presented secret rather than throwing", () => {
    expect(secretMatches(null, "s3cret")).toBe(false);
    expect(secretMatches(undefined, "s3cret")).toBe(false);
    expect(secretMatches("", "s3cret")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    // The route returns 503 before reaching this, but a helper that returned
    // true for `("", "")` would make an unset JOBS_SECRET mean "open to all".
    expect(secretMatches("anything", "")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
  });

  it("compares different lengths without throwing", () => {
    // `timingSafeEqual` throws on unequal lengths, and the throw would itself
    // be the length leak the constant-time comparison exists to avoid. Both
    // sides are hashed to a fixed width first.
    expect(() => secretMatches("a", "a-much-longer-secret-value")).not.toThrow();
    expect(secretMatches("a", "a-much-longer-secret-value")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads the token out of an Authorization header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
  });

  it("returns null for anything that is not a bearer token", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer    ")).toBeNull();
  });
});

describe("pathsToRevalidate", () => {
  it("gives a page its own path, through the home-slug special case", () => {
    expect(pathsToRevalidate([published({ entityType: "page", slug: "about" })])).toEqual([
      "/about",
    ]);
    // `revalidatePath("/home")` would succeed, revalidate nothing, and leave the
    // homepage stale — the whole reason publicPathForPage exists.
    expect(pathsToRevalidate([published({ entityType: "page", slug: "home" })])).toEqual(["/"]);
  });

  it("gives an article both its own page and its category's", () => {
    // Revalidating only the article is the bug that looks like everything
    // working: live at its URL, absent from the section it belongs to.
    expect(
      pathsToRevalidate([published({ slug: "speed-considered", categorySlug: "culture" })])
    ).toEqual(["/article/speed-considered", "/culture"]);
  });

  it("gives an unfiled article one path", () => {
    expect(pathsToRevalidate([published({ slug: "orphan", categorySlug: null })])).toEqual([
      "/article/orphan",
    ]);
  });

  it("deduplicates a category two articles share", () => {
    const paths = pathsToRevalidate([
      published({ slug: "one", categorySlug: "style" }),
      published({ slug: "two", categorySlug: "style" }),
    ]);

    expect(paths).toEqual(["/article/one", "/style", "/article/two"]);
    expect(paths.filter((p) => p === "/style")).toHaveLength(1);
  });

  it("returns nothing for an empty run", () => {
    expect(pathsToRevalidate([])).toEqual([]);
  });
});

describe("the job vocabulary", () => {
  it("matches the job_runs CHECK in 0006_ingestion.sql", () => {
    expect([...JOB_RUN_STATUSES]).toEqual(["running", "ok", "failed"]);
  });

  it("names the job once, since two tables key on it", () => {
    expect(PUBLISH_SCHEDULED_JOB).toBe("publish-scheduled");
  });
});
