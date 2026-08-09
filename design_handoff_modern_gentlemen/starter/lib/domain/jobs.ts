/**
 * Background jobs — vocabulary and the shared-secret check. Pure, no I/O.
 *
 * PROGRESS.md has carried the line "`JOBS_SECRET` is an env var **no code
 * reads**" for four phases. This is the file that finally reads it — and while
 * wiring it up, the variable turned out to be missing from `.env.example`
 * altogether, so anyone copying that file to `.env.local` would have got a
 * route that refuses every request. Added there in the same change.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { publicPathForArticle, publicPathForCategory, publicPathForPage } from "./routes";

/**
 * `scheduled_jobs.key` / `job_runs.job_key` for the publish runner.
 *
 * A constant rather than a string at each call site: the two tables key on it,
 * and a typo would write a run nobody ever looks at under a job that does not
 * exist.
 */
export const PUBLISH_SCHEDULED_JOB = "publish-scheduled";

/** `job_runs.status` — the CHECK in `0006_ingestion.sql`. */
export const JOB_RUN_STATUSES = ["running", "ok", "failed"] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

/** One document the runner published, as `run_due_publishes` returns it. */
export interface PublishedOnSchedule {
  entityType: "page" | "article";
  entityId: string;
  slug: string;
  /** An article's category, which is a second page to revalidate. Null for a
   *  page, and for an article nobody has filed. */
  categorySlug: string | null;
  version: number;
}

/**
 * Constant-time comparison of a presented secret against the expected one.
 *
 * `a === b` on a secret leaks its length and its matching prefix through timing.
 * That is a small leak against a remote attacker and a free one to close, and
 * this endpoint publishes content to a live site — the one thing an attacker
 * would want from it is exactly the ability to make it fire.
 *
 * Both sides are hashed to a fixed width first, because `timingSafeEqual`
 * throws on length mismatch and throwing *is* the length leak it was meant to
 * avoid.
 */
export function secretMatches(presented: string | null | undefined, expected: string): boolean {
  if (!presented || !expected) return false;

  // Widths are equal by construction after this, so the comparison is the only
  // thing the timing depends on.
  const encoder = new TextEncoder();
  const a = sha256Width(encoder.encode(presented));
  const b = sha256Width(encoder.encode(expected));

  return timingSafeEqual(a, b);
}

/**
 * A fixed-width digest of the input.
 *
 * `node:crypto`'s synchronous hash rather than `crypto.subtle`, which is
 * promise-based and would make the comparison async for no benefit.
 * `lib/domain` stays free of I/O and framework: a hash is neither.
 */
function sha256Width(bytes: Uint8Array): Buffer {
  return createHash("sha256").update(bytes).digest();
}

/**
 * The public paths a scheduled publish invalidated.
 *
 * An article touches two — its own page and the category page whose lead and
 * grid are bound to the `articles` table. Revalidating only the first is the bug
 * that looks like everything working: the article is live at its URL and absent
 * from the section it belongs to. `app/(admin)/admin/articles/revalidate.ts`
 * records the same reasoning for the editor path; this is the jobs-side copy,
 * pure because the runner already returned the category slug.
 */
export function pathsToRevalidate(published: PublishedOnSchedule[]): string[] {
  const paths = published.flatMap((row) =>
    row.entityType === "page"
      ? [publicPathForPage(row.slug)]
      : [
          publicPathForArticle(row.slug),
          ...(row.categorySlug ? [publicPathForCategory(row.categorySlug)] : []),
        ]
  );

  // Two articles in one run commonly share a category.
  return [...new Set(paths)];
}

/**
 * The `Authorization: Bearer <secret>` value, or null.
 *
 * A bearer header rather than a query parameter: query strings turn up in
 * access logs, proxy logs and browser history, and a secret that reaches a log
 * is a secret that has to be rotated.
 */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}
