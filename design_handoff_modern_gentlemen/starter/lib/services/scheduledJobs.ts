/**
 * The scheduled-publish runner's application half.
 *
 * `schedule_document` has existed since 0010 and the builder has offered a date
 * picker since Phase 4, but nothing ever fired one. This is what fires it.
 *
 * **The service-role client is correct here and almost nowhere else.** A
 * scheduled job has no user session, which is exactly the case `lib/db/admin.ts`
 * lists as legitimate. The authority to publish was granted earlier, when an
 * editor scheduled the document and `schedule_document` asserted
 * `<type>.publish`; this carries out that decision rather than making a new one.
 *
 * All the real work is one transaction inside the database
 * (`run_due_publishes`, 0015). Doing it here — select the due rows, publish
 * each, write the history — would be the sequence of PostgREST calls that 0010
 * exists to prevent.
 */

import { createAdminClient } from "@/lib/db/admin";
import {
  publicPathForArticle,
  publicPathForCategory,
  publicPathForPage,
} from "@/lib/domain/routes";

export interface PublishedOnSchedule {
  entityType: string;
  entityId: string;
  version: number;
  slug: string;
  categorySlug: string | null;
}

export interface JobRunResult {
  published: PublishedOnSchedule[];
  /** Every public path the run invalidated, deduplicated. */
  paths: string[];
}

/**
 * Which public paths a published document affects.
 *
 * An article affects two — its own page and the category listing bound to the
 * `articles` table — which is the same rule `revalidatePublicArticle` follows
 * in the admin. A page affects one, with the homepage's slug/path mismatch
 * handled by `publicPathForPage`.
 */
export function pathsFor(row: PublishedOnSchedule): string[] {
  if (row.entityType === "article") {
    return [
      publicPathForArticle(row.slug),
      ...(row.categorySlug ? [publicPathForCategory(row.categorySlug)] : []),
    ];
  }
  if (row.entityType === "page") return [publicPathForPage(row.slug)];
  return [];
}

interface RunDueRow {
  entity_type: string;
  entity_id: string;
  version: number;
  slug: string;
  category_slug: string | null;
}

/**
 * Publishes everything due and records the attempt in `job_runs`.
 *
 * The bookkeeping is deliberately outside the publish transaction: a failure to
 * write a log row must not roll back work that succeeded, and a run that
 * published nothing is still a run worth recording — "the scheduler is alive
 * and there was nothing to do" and "the scheduler never ran" look identical
 * without it.
 */
export async function runDuePublishes(limit = 100): Promise<JobRunResult> {
  const db = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: run } = await db
    .from("job_runs")
    .insert({ job_key: JOB_KEY, status: "running", started_at: startedAt })
    .select("id")
    .single();

  try {
    // `database.types.ts` is generated from the schema and does not yet know
    // about `run_due_publishes` — 0015 has to be applied before `npm run
    // db:types` can see it. Casting the one call is the honest option; the
    // alternative is hand-editing a generated file, which the next regeneration
    // would silently undo. **Re-run `db:types` once 0015 is applied and delete
    // this cast** — it is tracked in PROGRESS.md.
    const rpc = db.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: RunDueRow[] | null; error: { message: string } | null }>;

    const { data, error } = await rpc("run_due_publishes", { p_limit: limit });
    if (error) throw new Error(error.message);

    const published: PublishedOnSchedule[] = (data ?? []).map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      version: row.version,
      slug: row.slug,
      categorySlug: row.category_slug,
    }));

    const paths = [...new Set(published.flatMap(pathsFor))];

    if (run) {
      await db
        .from("job_runs")
        .update({
          status: "ok",
          finished_at: new Date().toISOString(),
          detail: { published: published.length, paths },
        })
        .eq("id", run.id);
    }

    return { published, paths };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run) {
      await db
        .from("job_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
        .eq("id", run.id);
    }
    throw error;
  }
}

/** `job_runs.job_key` is free text; one constant keeps queries honest. */
export const JOB_KEY = "publish-scheduled";
