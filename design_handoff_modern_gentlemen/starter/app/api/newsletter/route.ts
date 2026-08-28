import { NextResponse, type NextRequest } from "next/server";

import { subscribeToNewsletter } from "@/lib/services/newsletter";
import { clientIdentity, NEWSLETTER_PER_CALLER } from "@/lib/services/rateLimit";

/**
 * Newsletter sign-up.
 *
 * `POST /api/newsletter`, `{ email, source }`. **The site's first public write
 * endpoint** — the jobs routes are the only other handlers here and both are
 * secret-gated operator endpoints. Everything below follows from that.
 *
 * **No secret and no session, by design.** A visitor who has never signed in
 * must be able to use it. What protects the table is `0024`: `anon` holds INSERT
 * on three columns and no SELECT at all, so the worst a forged request achieves
 * is adding a row that a person could have added through the form.
 *
 * ⚠️ **The same answer for a new address and one already on the list — and the
 * service could not tell you which even if it wanted to.** "You are already
 * subscribed" is an enumeration oracle: it turns this endpoint into a way to
 * test whether a given person reads this magazine, one address at a time,
 * without ever seeing the list. Same reason `/forgot-password` does not confirm
 * whether an account exists. Here it is enforced by the grant rather than by
 * restraint — reading the row back needs a SELECT `anon` does not have.
 *
 * **Rate limited, in the database.** The unique constraint on `email` bounds
 * repeats of one address; two fixed-window counters bound a flood of distinct
 * ones. They live in Postgres (`0026`) rather than in this process because
 * Railway can run more than one container — see `lib/services/rateLimit.ts` for
 * the per-caller and global split, and for why the forged-header case is the
 * reason there are two.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    // A malformed body is a client error, and it is worth distinguishing from a
    // rejected address so the form can tell "we could not read that" from
    // "that is not an email".
    return NextResponse.json({ ok: false, reason: "invalid-email" }, { status: 400 });
  }

  const input = (body ?? {}) as { email?: unknown; source?: unknown };
  const outcome = await subscribeToNewsletter({
    email: input.email,
    source: input.source,
    identity: clientIdentity(request.headers),
  });

  if (!outcome.ok) {
    // 400 for an address this cannot use, 429 for too many attempts, 503 for our
    // own failure. Three, because the visitor can act on each differently: fix
    // it, wait, or nothing.
    if (outcome.reason === "rate-limited") {
      // `Retry-After` in seconds, and it is the **whole** window rather than the
      // time remaining in it: the counter is a fixed window and does not report
      // how far through it the caller is. Over-stating it is the safe direction
      // — a client that waits too long succeeds, one that waits too little is
      // refused again.
      return NextResponse.json(outcome, {
        status: 429,
        headers: { "Retry-After": String(NEWSLETTER_PER_CALLER.windowSeconds) },
      });
    }

    if (outcome.reason === "unavailable") {
      console.error("Newsletter sign-up failed — see the service layer for the cause.");
    }
    return NextResponse.json(outcome, { status: outcome.reason === "invalid-email" ? 400 : 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/**
 * Anything other than POST.
 *
 * Spelled out rather than left to Next's default so the answer is a deliberate
 * 405 with an `Allow` header, which is what a crawler or a misconfigured client
 * needs to see. The jobs routes take the same stance.
 */
export function GET() {
  return NextResponse.json(
    { ok: false, reason: "method-not-allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
