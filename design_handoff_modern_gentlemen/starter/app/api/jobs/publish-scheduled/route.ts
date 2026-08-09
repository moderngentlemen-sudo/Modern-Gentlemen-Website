import { NextResponse, type NextRequest } from "next/server";

import { bearerToken, secretMatches } from "@/lib/domain/jobs";
import { runScheduledPublishes } from "@/lib/services/scheduledPublishing";

/**
 * Fire the scheduled publishes that are due.
 *
 * `POST /api/jobs/publish-scheduled`, with `Authorization: Bearer $JOBS_SECRET`.
 *
 * **POST, not GET.** This changes what the public site serves, and a GET that
 * mutates gets fired by link prefetchers, security scanners and anything that
 * follows URLs for a living.
 *
 * **`JOBS_SECRET` is read here and nowhere else.** PROGRESS.md has noted for
 * four phases that nothing read it; this is the reader. It was also absent from
 * `.env.example`, which is now fixed. Absent at runtime, the route refuses every
 * request rather than defaulting to open — an endpoint that publishes content must fail closed, and a deploy that
 * forgot the variable should be visibly broken rather than quietly unguarded.
 *
 * The service-role key never leaves the server: the route runs on the server,
 * calls the service, and returns a summary. Nothing about this is reachable
 * from a browser holding the anon key — `run_due_publishes` is granted to
 * `service_role` alone.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.JOBS_SECRET;

  if (!expected) {
    console.error("JOBS_SECRET is not set — refusing to run the scheduled-publish job.");
    return NextResponse.json({ error: "Jobs are not configured" }, { status: 503 });
  }

  if (!secretMatches(bearerToken(request.headers.get("authorization")), expected)) {
    // No detail: a 401 that explains itself tells an attacker which half they
    // got right.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runScheduledPublishes();

    return NextResponse.json({
      ok: true,
      published: report.published.length,
      revalidated: report.revalidated,
      entities: report.published.map(({ entityType, slug, version }) => ({
        entityType,
        slug,
        version,
      })),
    });
  } catch (error) {
    // The run recorded its own failure in `job_runs` before rethrowing. What
    // matters here is the status code: a caller that retries on failure must be
    // able to tell a failed run from an empty one, and both would otherwise be
    // a 200 with `published: 0`.
    console.error("Scheduled publish run failed:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
