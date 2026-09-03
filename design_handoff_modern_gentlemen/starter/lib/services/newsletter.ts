/**
 * Newsletter sign-up — the public write path.
 *
 * **No `requirePermission` call, deliberately**, and for the opposite reason to
 * `publicCatalog.ts`. That file reads content the database already scopes to
 * published rows; this one *writes*, and what makes it safe is that `0024`
 * grants `anon` INSERT on three columns and nothing else. There is no session
 * to check — the whole point is that a visitor who has never signed in can do
 * this — so the gate is the grant, not a permission.
 *
 * ⚠️ **It uses the anonymous client, not the service-role one.** That is the
 * load-bearing choice. A service-role client would bypass RLS entirely, which
 * would make the route the only thing standing between the internet and the
 * table — and the route is a public endpoint. Using `createPublicClient()` means
 * the database enforces the same rules whether the write arrives through this
 * service or through a hand-rolled PostgREST call with the publishable key.
 *
 * ⚠️ **The rate limit is the one thing here that a hand-rolled PostgREST call
 * does bypass**, and it is worth being explicit rather than letting the
 * paragraph above imply otherwise. `rate_limit_hit` is called by this service;
 * nothing obliges a caller holding the publishable key to call it before
 * inserting. Closing that would mean moving the check into a `before insert`
 * trigger on `newsletter_subscribers`, which cannot see the request headers and
 * so has no caller to key on. The limit is therefore a bound on abuse *through
 * the form*, which is what a form on a public page attracts; the grant is still
 * what bounds abuse in general, and it is why the worst case is a table of
 * addresses rather than anything read back out.
 */

import { createPublicClient } from "@/lib/db/public";
import { createClient } from "@/lib/db/server";
import { insertSubscriber } from "@/lib/db/repositories/newsletter";
import { listSubscribers as listSubscriberRows } from "@/lib/db/repositories/newsletter";
import {
  isPlausibleEmail,
  isSubscriberSource,
  normaliseEmail,
  type SubscribeOutcome,
} from "@/lib/domain/newsletter";
import { consumeRateLimit, NEWSLETTER_GLOBAL, NEWSLETTER_PER_CALLER } from "./rateLimit";
import { requirePermission } from "./auth";

export async function subscribeToNewsletter(input: {
  email: unknown;
  source: unknown;
  /** From `clientIdentity(request.headers)`. Null where no proxy set one. */
  identity: string | null;
}): Promise<SubscribeOutcome> {
  // ⚠️ **Before the address is looked at, and that ordering is the design.**
  // Validating first would make a malformed address a free request, which is
  // the cheapest possible thing for an abusive caller to send — so the limit is
  // spent on every request that arrives, not only on the ones that would write
  // a row. The cost is that a visitor correcting a typo spends budget doing it,
  // which is what `NEWSLETTER_PER_CALLER`'s limit is sized for.
  //
  // Two buckets, and both are consumed rather than short-circuited on the
  // first: `&&` would leave the global counter unincremented for exactly the
  // callers it exists to bound. `Promise.all` because they are independent.
  const [callerAllowed, globalAllowed] = await Promise.all([
    input.identity === null
      ? Promise.resolve(true)
      : consumeRateLimit({
          scope: "newsletter",
          identity: input.identity,
          ...NEWSLETTER_PER_CALLER,
        }),
    consumeRateLimit({ scope: "newsletter", identity: "*", ...NEWSLETTER_GLOBAL }),
  ]);

  if (!callerAllowed || !globalAllowed) return { ok: false, reason: "rate-limited" };

  if (typeof input.email !== "string" || !isPlausibleEmail(input.email)) {
    return { ok: false, reason: "invalid-email" };
  }

  const email = normaliseEmail(input.email);
  // An unrecognised source is recorded as `unknown` rather than refused: a
  // stale cached bundle posting an old block name should still capture the
  // address. The CHECK constraint would reject anything else outright.
  const source = isSubscriberSource(input.source) ? input.source : "unknown";

  try {
    await insertSubscriber(createPublicClient(), { email, source });
    // No detail: a repeat sign-up is indistinguishable from a new one here, by
    // construction rather than by policy. See `insertSubscriber`.
    return { ok: true };
  } catch {
    // ⚠️ Swallowed on purpose, and the message is not passed on. A failing
    // insert here is a database or configuration problem, and its text can
    // name tables, columns and constraints — none of which belongs in a
    // response to an anonymous caller. The route logs; the visitor gets
    // "unavailable".
    return { ok: false, reason: "unavailable" };
  }
}

/** Staff-only handoff view; lifecycle writes wait for the chosen ESP/double-opt-in flow. */
export async function listNewsletterSubscribers(limit = 250) {
  await requirePermission("integration.read");
  const db = await createClient();
  return listSubscriberRows(db, Math.min(Math.max(Math.trunc(limit), 1), 5_000));
}
