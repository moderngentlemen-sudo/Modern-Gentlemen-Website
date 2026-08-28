/**
 * Fixed-window rate limiting for the public write endpoints.
 *
 * **Why this is not a `Map` in module scope.** Railway can run more than one
 * container, and Next route handlers are not guaranteed to share a process even
 * within one, so an in-memory counter enforces a limit that varies with how the
 * platform happens to schedule you — and reads as working in every test, since
 * a test runs one process. The state has to live somewhere both containers can
 * see, and the database is the only such place this deployment has. `0026` holds
 * the counter and the `rate_limit_hit` function; this module is the caller.
 *
 * **It fails open, at both ends.** The SQL swallows its own errors and returns
 * `true`; so does this. A limiter in front of a newsletter sign-up exists to
 * stop bulk insertion, not to protect money — if the counter itself is broken,
 * refusing every visitor is the worse outcome. A limiter in front of something
 * costlier should fail closed, and would need this decision taken again.
 */

import { createHash } from "node:crypto";

import { createPublicClient } from "@/lib/db/public";

/**
 * What the newsletter endpoint allows.
 *
 * Two buckets rather than one, and the second is the load-bearing half — see
 * `clientIdentity` for why the first can be forged. The global ceiling is sized
 * so that normal traffic never approaches it and a single forging caller still
 * cannot run unbounded.
 *
 * **Ten per caller rather than the five this started at**, because the limit is
 * consumed *before* the address is validated — it has to be, or an invalid
 * address would be an unlimited request — and a visitor correcting a typo spends
 * budget doing it. Ten leaves room for that and is still nowhere near what
 * filling a table takes.
 */
export const NEWSLETTER_PER_CALLER = { limit: 10, windowSeconds: 600 } as const;
export const NEWSLETTER_GLOBAL = { limit: 300, windowSeconds: 3600 } as const;

/**
 * Who is calling, as far as anything behind a proxy can tell.
 *
 * `x-forwarded-for` is a list, appended to hop by hop; the **first** entry is
 * what the edge saw. `app/auth/_lib/publicUrl.ts` records the same lesson for
 * `x-forwarded-host`: behind Railway's proxy the connection address is the
 * container's, so the header is the only source of the caller's address.
 *
 * ⚠️ **And it is attacker-supplied, which `publicUrl` could check and this
 * cannot.** `publicUrl` validates the forwarded host against a value we already
 * know is ours; there is no equivalent for an IP — any address is a plausible
 * one. So a caller who sets a different `x-forwarded-for` on every request gets
 * a fresh bucket every time. That is the standard, unavoidable weakness of
 * IP-derived limiting behind a proxy whose hop count is not fixed, and it is
 * precisely why the endpoint also consumes a **global** bucket that no header
 * can escape. The per-caller limit is what keeps one honest visitor from
 * hammering the form; the global one is what actually bounds the table.
 *
 * Null when the header is absent (local dev, the test runner). The caller then
 * skips the per-caller bucket rather than lumping every visitor into one key,
 * which would rate-limit the whole site to five sign-ups.
 */
export function clientIdentity(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  // Some proxies send this instead, and it is a single value rather than a list.
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * The bucket key: hashed, so the table never holds an address.
 *
 * ⚠️ **A bare SHA-256 of an IPv4 address is reversible** — the whole space is
 * 2^32 and a laptop walks it in seconds — so the hash on its own is obfuscation
 * rather than anonymisation. Two things make it more than that. `RATE_LIMIT_SALT`,
 * when set, puts the space out of reach entirely; and `0026` prunes rows after a
 * day regardless, so the window in which anything is recoverable is bounded even
 * when the salt is unset. The salt is optional because requiring a new variable
 * would have made the limiter fail to deploy rather than fail to anonymise, and
 * a limiter that is not running protects nothing.
 */
function bucketKey(scope: string, identity: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "";
  return `${scope}:${createHash("sha256").update(`${salt}:${identity}`).digest("hex").slice(0, 32)}`;
}

/** Postgres renders an interval from `'N seconds'`; PostgREST passes it as text. */
function intervalFor(seconds: number): string {
  return `${Math.max(1, Math.floor(seconds))} seconds`;
}

/**
 * Consume one unit from a bucket. `true` means the caller may proceed.
 *
 * `scope` names the thing being limited and is part of the key, so the same
 * address hitting two endpoints does not share a counter.
 */
export async function consumeRateLimit(input: {
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  try {
    const { data, error } = await createPublicClient().rpc("rate_limit_hit", {
      p_key: bucketKey(input.scope, input.identity),
      p_limit: input.limit,
      p_window: intervalFor(input.windowSeconds),
    });

    // `data === false` is the only refusal. A null from a transport-level
    // problem is not one, and must not be read as one — see the note above.
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
