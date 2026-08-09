/**
 * The scheduled-publish runner.
 *
 * Fires everything whose `scheduled_for` has passed, then tells Next which
 * public paths went stale. `0010`'s `schedule_document` has recorded the intent
 * since Phase 3 and its own comment promised this; the builder has been telling
 * editors it does nothing.
 *
 * **This is one of the few legitimate service-role callers**, and `lib/db/admin.ts`
 * names the case in its own header: "scheduled ingestion jobs (no user session
 * exists)". There is no editor to act as — that is the entire point of a
 * schedule — and `run_due_publishes` is granted to `service_role` alone.
 *
 * No `requirePermission` here, deliberately, and it is not an oversight: the
 * permission was checked when the schedule was *set*. `schedule_document`
 * asserts `<type>.publish` before it will accept a date, so by the time a row is
 * eligible, a person with the right to publish it has already said so. Checking
 * again here would mean checking it against nobody.
 */

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/db/admin";
import * as repo from "@/lib/db/repositories/scheduledJobs";
import {
  pathsToRevalidate,
  PUBLISH_SCHEDULED_JOB,
  type PublishedOnSchedule,
} from "@/lib/domain/jobs";

export interface RunReport {
  published: PublishedOnSchedule[];
  revalidated: string[];
}

/**
 * Run once.
 *
 * The `job_runs` row is opened before the work and closed after it, including
 * on failure — a job whose only trace is its successes is a job you cannot
 * debug. The error is recorded and then rethrown, so the caller can answer with
 * a 500 rather than reporting a run that did not happen as fine.
 */
export async function runScheduledPublishes(limit = 100): Promise<RunReport> {
  const db = createAdminClient();
  const runId = await repo.startJobRun(db, PUBLISH_SCHEDULED_JOB);

  try {
    const published = await repo.runDuePublishes(db, limit);
    const revalidated = pathsToRevalidate(published);

    // After the database work, never before: revalidating a path whose content
    // has not changed yet just rebuilds the old page and throws away the only
    // signal that it needed rebuilding.
    for (const path of revalidated) revalidatePath(path);

    await repo.finishJobRun(db, runId, "ok", {
      published: published.length,
      revalidated,
      entities: published.map((p) => `${p.entityType}:${p.slug}@v${p.version}`),
    });

    // Best-effort: the schedule lives in whatever calls this route, and a
    // missing `scheduled_jobs` row must not fail a run that already published.
    await repo.touchScheduledJob(db, PUBLISH_SCHEDULED_JOB).catch(() => {});

    return { published, revalidated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Recorded before rethrowing, and deliberately not swallowed: a run that
    // failed must both leave a trace and produce a non-200.
    await repo
      .finishJobRun(db, runId, "failed", {}, message)
      .catch(() => {}); /* the run failing is the news, not the bookkeeping */
    throw error;
  }
}
