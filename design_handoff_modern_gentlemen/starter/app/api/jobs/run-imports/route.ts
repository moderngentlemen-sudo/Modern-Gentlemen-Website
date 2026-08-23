import { NextResponse, type NextRequest } from "next/server";

import { bearerToken, secretMatches } from "@/lib/domain/jobs";
import { runDueImports } from "@/lib/services/scheduledImports";

/**
 * Run the product feeds that are due.
 *
 * `POST /api/jobs/run-imports`, with `Authorization: Bearer $JOBS_SECRET`.
 *
 * The publish runner's twin, and every decision in that file's header applies
 * here unchanged: POST because it mutates, `JOBS_SECRET` read here and compared
 * in constant time, fail closed when the variable is absent, no detail in the
 * 401. What follows is only what differs.
 *
 * **The same secret as the publish job, deliberately.** Two secrets would mean
 * two things to rotate and two ways for a deploy to be half-configured, for no
 * gain — both endpoints are the same trust boundary (an operator's automation
 * knocking on the app) and both fail closed together.
 *
 * ⚠️ **This stages; it does not publish anything.** A due run ends in `review`
 * with proposals waiting for a person, exactly as the manual button does. That
 * is why this route is a far smaller blast radius than its name suggests, and
 * why it is safe to fire on a schedule at all.
 *
 * ⚠️ **A 200 here does not mean every feed succeeded.** `ran[].status` carries
 * each source's outcome and a failed source is reported inside a successful
 * run, because one merchant's CDN being down is not a failure of the runner.
 * The status code answers "did the runner work"; the body answers "what
 * happened to each feed". A caller that alerts on non-200 alone will miss a
 * feed that has been failing for a week — `last_status` on the source is what
 * an operator should be watching.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.JOBS_SECRET;

  if (!expected) {
    console.error("JOBS_SECRET is not set — refusing to run the scheduled-import job.");
    return NextResponse.json({ error: "Jobs are not configured" }, { status: 503 });
  }

  if (!secretMatches(bearerToken(request.headers.get("authorization")), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runDueImports();

    return NextResponse.json({
      ok: true,
      ran: report.ran.length,
      deferred: report.deferred,
      sources: report.ran.map(({ name, status, jobId, error }) => ({
        name,
        status,
        jobId,
        ...(error ? { error } : {}),
      })),
    });
  } catch (error) {
    console.error("Scheduled import run failed:", error);

    // The same split the publish route documents: a missing variable is a
    // *deployment* problem and deserves its own answer, or "SUPABASE_SERVICE_
    // ROLE_KEY was never set in Railway" reads as "the job is broken".
    // `required()` names the variable and never includes its value.
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Missing environment variable")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
