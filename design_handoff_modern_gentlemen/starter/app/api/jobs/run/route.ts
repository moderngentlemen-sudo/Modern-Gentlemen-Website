import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { jobsSecret } from "@/lib/db/env";
import { runDuePublishes } from "@/lib/services/scheduledJobs";

/**
 * The scheduler's entry point: publish everything whose time has come.
 *
 * Call it from anything that can make an authenticated POST on a timer — a
 * platform cron, GitHub Actions, an uptime pinger:
 *
 *   curl -X POST https://<host>/api/jobs/run \
 *        -H "Authorization: Bearer $JOBS_SECRET"
 *
 * **POST, not GET.** It changes the site. A GET would be fetched by link
 * prefetchers, preview crawlers and anything that treats URLs as safe to
 * retrieve, and "something crawled us and published six drafts" is not a
 * failure mode worth having.
 *
 * **Never prerendered.** `force-dynamic` because the whole point is to run on
 * request; a cached job endpoint would report the previous run's result.
 */
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison, and it is not superstition here.
 *
 * The secret is long-lived and an attacker can call this endpoint as often as
 * they like, which is exactly the shape a timing oracle needs. `timingSafeEqual`
 * throws on a length mismatch, so the lengths are compared first — that leaks
 * only the length, which a caller controls anyway.
 */
function presentedSecretMatches(header: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) return false;

  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(presented, expected);
}

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = jobsSecret();
  } catch {
    // The variable is unset. Refuse everything rather than run unauthenticated —
    // and say so without naming the variable, since this response is public.
    return NextResponse.json({ error: "Job runner is not configured" }, { status: 503 });
  }

  if (!presentedSecretMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { published, paths } = await runDuePublishes();

    // Revalidation happens here rather than in the service because
    // `revalidatePath` is a Next API and the service is called by tests that
    // have no Next request context.
    for (const path of paths) revalidatePath(path);

    return NextResponse.json({
      ok: true,
      published: published.length,
      documents: published.map((row) => ({
        type: row.entityType,
        slug: row.slug,
        version: row.version,
      })),
      revalidated: paths,
    });
  } catch (error) {
    // The run is already recorded as failed in `job_runs`; this is the caller's
    // copy. The message is included because the caller is authenticated.
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
