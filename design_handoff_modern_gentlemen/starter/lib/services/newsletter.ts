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
 */

import { createPublicClient } from "@/lib/db/public";
import { insertSubscriber } from "@/lib/db/repositories/newsletter";
import {
  isPlausibleEmail,
  isSubscriberSource,
  normaliseEmail,
  type SubscribeOutcome,
} from "@/lib/domain/newsletter";

export async function subscribeToNewsletter(input: {
  email: unknown;
  source: unknown;
}): Promise<SubscribeOutcome> {
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
