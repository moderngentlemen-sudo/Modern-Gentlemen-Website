/**
 * The scheduled-feed runner.
 *
 * Fires every enabled source whose `sync_schedule` says it is due. The column
 * has existed since `0005` and PROGRESS.md has carried "stored and read by
 * nothing" for three phases; this is the reader, and the selector that writes it
 * landed in the same change — a schedule nobody can set is the same gap as a
 * schedule nobody reads, met from the other end.
 *
 * Structurally `scheduledPublishing.ts`, and deliberately so: same admin client,
 * same `job_runs` bookkeeping, same "record the failure, then rethrow so the
 * route can answer non-200". Two runners that behave differently under failure
 * would mean two things to learn.
 *
 * ⚠️ **A scheduled run stages proposals and never applies them.** It ends at
 * `review` exactly as the manual button does, and `applyJob` — the only thing
 * that writes `products` — still needs a person. A feed that could reach the
 * live catalogue unattended is precisely what `FEED_TARGET_FIELDS` refuses
 * `status` for, and a schedule must not be the way around it.
 *
 * ⚠️ **Sources run one at a time, and the slowest one can end the run.** Each is
 * a network fetch of a whole merchant catalogue; firing them together is how a
 * runner with six sources gets itself rate-limited by all six at once. `limit`
 * bounds how many are attempted per tick, so a project that grows to thirty
 * feeds does not turn one HTTP request into a thirty-minute one — the rest are
 * still due on the next tick, because nothing has been marked as run.
 */

import { createAdminClient } from "@/lib/db/admin";
import * as ingestionRepo from "@/lib/db/repositories/ingestion";
import * as jobsRepo from "@/lib/db/repositories/scheduledJobs";
import { isSyncDue } from "@/lib/domain/ingestion";
import { IMPORT_SCHEDULED_JOB } from "@/lib/domain/jobs";
import { runImportCore } from "./ingestion";

export interface ScheduledRun {
  sourceId: string;
  name: string;
  jobId: string | null;
  status: "review" | "completed" | "failed";
  /** Present when the run failed outright rather than staging failures. */
  error?: string;
}

export interface ImportRunReport {
  /** Sources that were due and attempted this tick. */
  ran: ScheduledRun[];
  /** Due sources left for the next tick because `limit` was reached. */
  deferred: number;
}

/**
 * Run once.
 *
 * `limit` defaults low on purpose. A tick that attempts everything is a tick
 * that can outlive the platform's request timeout, and a runner killed halfway
 * leaves its `job_runs` row open — the one state that makes the table useless
 * for answering "did it run".
 */
export async function runDueImports(limit = 5, now: Date = new Date()): Promise<ImportRunReport> {
  const db = createAdminClient();
  const runId = await jobsRepo.startJobRun(db, IMPORT_SCHEDULED_JOB);

  try {
    const sources = await ingestionRepo.listSources(db);

    // `enabled` first: a disabled source keeps its schedule, so that switching
    // one off and on again does not lose the setting. Filtering on it here is
    // what makes that safe.
    const due = sources.filter(
      (source) => source.enabled && isSyncDue(source.sync_schedule, source.last_synced_at, now)
    );

    const attempt = due.slice(0, limit);
    const ran: ScheduledRun[] = [];

    for (const source of attempt) {
      try {
        const result = await runImportCore(db, source.id, {
          trigger: "scheduled",
          // No user: this is the case `import_jobs.requested_by` is nullable
          // for. A run attributed to whoever last touched the source would be
          // a lie an audit trail cannot recover from.
          requestedBy: null,
        });
        ran.push({
          sourceId: source.id,
          name: source.name,
          jobId: result.jobId,
          status: result.status,
        });
      } catch (error) {
        // One source failing must not stop the others. `runImportCore` already
        // records a failed job and a failed `last_status` for the *expected*
        // failures (an unreachable feed, an unmapped source); reaching here
        // means something unexpected, so it is reported and the loop continues.
        const message = error instanceof Error ? error.message : String(error);
        ran.push({
          sourceId: source.id,
          name: source.name,
          jobId: null,
          status: "failed",
          error: message,
        });
      }
    }

    const report: ImportRunReport = { ran, deferred: due.length - attempt.length };

    await jobsRepo.finishJobRun(db, runId, "ok", {
      due: due.length,
      ran: ran.length,
      deferred: report.deferred,
      sources: ran.map((entry) => `${entry.name}:${entry.status}`),
    });

    // Best-effort, exactly as the publish runner has it: the schedule lives in
    // whatever calls the route, and a missing `scheduled_jobs` row must not fail
    // a run that already did its work.
    await jobsRepo.touchScheduledJob(db, IMPORT_SCHEDULED_JOB).catch(() => {});

    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await jobsRepo
      .finishJobRun(db, runId, "failed", {}, message)
      .catch(() => {}); /* the run failing is the news, not the bookkeeping */
    throw error;
  }
}
