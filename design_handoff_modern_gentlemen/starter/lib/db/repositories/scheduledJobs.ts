/**
 * The scheduled-publish runner's data access: the RPC that fires it, and the
 * `job_runs` bookkeeping around it.
 *
 * Client-first like every other repository. In practice there is exactly one
 * caller and it passes the **service-role** client, because `run_due_publishes`
 * is granted to `service_role` alone — see `0016_scheduled_publishing.sql` for
 * why a background job cannot use the ordinary publish path.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { unwrap } from "./errors";
import type { JobRunStatus, PublishedOnSchedule } from "@/lib/domain/jobs";

type Db = SupabaseClient<Database>;

interface DuePublishRow {
  entity_type: string;
  entity_id: string;
  slug: string;
  category_slug: string | null;
  version: number;
}

/**
 * The one call `database.types.ts` does not know about.
 *
 * `0016` is newer than the last `npm run db:types`, and regenerating requires
 * reaching the live project — which is exactly what a fresh container cannot do.
 * Rather than `as any`, the shape being asserted is written out: the assertion
 * is then reviewable, and it stops compiling correctly the moment the real
 * signature differs. Delete this and the cast below after the next `db:types`.
 */
interface DuePublishRpc {
  rpc(
    fn: "run_due_publishes",
    args: { p_limit: number }
  ): PromiseLike<{ data: DuePublishRow[] | null; error: PostgrestError | null }>;
}

/**
 * Publish everything whose scheduled time has passed.
 *
 * One round trip: the function loops, locks and writes inside the database, so
 * there is no window in which this code holds a list of "documents I am about
 * to publish" that another runner could also be holding.
 */
export async function runDuePublishes(db: Db, limit = 100): Promise<PublishedOnSchedule[]> {
  const rows =
    unwrap(
      "runDuePublishes",
      await (db as unknown as DuePublishRpc).rpc("run_due_publishes", { p_limit: limit })
    ) ?? [];

  return rows.map((row) => ({
    entityType: row.entity_type === "page" ? "page" : "article",
    entityId: row.entity_id,
    slug: row.slug,
    categorySlug: row.category_slug,
    version: row.version,
  }));
}

/**
 * Open a `job_runs` row before the work starts.
 *
 * Written before rather than after so a run that dies mid-flight leaves a
 * `running` row behind rather than no row at all. An operator seeing `running`
 * from an hour ago knows something crashed; seeing nothing tells them the job
 * never fired, which is a different problem with a different fix.
 */
export async function startJobRun(db: Db, jobKey: string): Promise<string> {
  const row = unwrap(
    "startJobRun",
    await db.from("job_runs").insert({ job_key: jobKey, status: "running" }).select("id").single()
  ) as { id: string };

  return row.id;
}

export async function finishJobRun(
  db: Db,
  id: string,
  status: Exclude<JobRunStatus, "running">,
  detail: Record<string, unknown>,
  error?: string
): Promise<void> {
  unwrap(
    "finishJobRun",
    await db
      .from("job_runs")
      .update({
        status,
        detail: detail as never,
        error: error ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id)
  );
}

/** Stamps `last_run_at` if a `scheduled_jobs` row exists for this key. Absent is
 *  fine — the schedule lives in whatever fires the route, and this table is a
 *  record of intent that nothing yet requires. */
export async function touchScheduledJob(db: Db, jobKey: string): Promise<void> {
  unwrap(
    "touchScheduledJob",
    await db
      .from("scheduled_jobs")
      .update({ last_run_at: new Date().toISOString() })
      .eq("key", jobKey)
  );
}
