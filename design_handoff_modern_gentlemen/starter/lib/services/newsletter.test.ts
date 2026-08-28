import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as RateLimit from "./rateLimit";

// `vi.hoisted`, because `vi.mock` is hoisted above the file's own declarations
// and a factory that names a `const` from below it throws "Cannot access before
// initialization" — reported as a mocking error pointing at the *module under
// test*, which is a long way from the line responsible.
const { insertSubscriber, consumeRateLimit } = vi.hoisted(() => ({
  insertSubscriber: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("@/lib/db/repositories/newsletter", () => ({ insertSubscriber }));
vi.mock("./rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  consumeRateLimit,
}));

import { subscribeToNewsletter } from "./newsletter";

/**
 * The sign-up service's decisions, in the order it takes them.
 *
 * The ordering is the part worth a test. Everything else here — the address
 * rules, the source vocabulary — is pure and covered in `lib/domain`; what only
 * this file decides is *when* the limit is spent, and that choice is invisible
 * in a passing request.
 */
describe("subscribeToNewsletter", () => {
  const good = { email: "Reader@Example.COM", source: "newsletter", identity: "203.0.113.7" };

  beforeEach(() => {
    insertSubscriber.mockReset().mockResolvedValue(undefined);
    consumeRateLimit.mockReset().mockResolvedValue(true);
  });

  it("normalises the address before storing it", async () => {
    await expect(subscribeToNewsletter(good)).resolves.toEqual({ ok: true });
    expect(insertSubscriber).toHaveBeenCalledWith(expect.anything(), {
      email: "reader@example.com",
      source: "newsletter",
    });
  });

  it("records an unrecognised source as `unknown` rather than refusing", async () => {
    // A stale cached bundle posting an old block name should still capture the
    // address; the CHECK constraint would reject anything else outright.
    await subscribeToNewsletter({ ...good, source: "some-old-block" });
    expect(insertSubscriber.mock.calls[0][1].source).toBe("unknown");
  });

  it("spends the rate limit BEFORE looking at the address", async () => {
    // ⚠️ The assertion this file exists for. Validating first would make a
    // malformed address a free request — the cheapest thing an abusive caller
    // can send — so a rejected address must still cost budget.
    consumeRateLimit.mockResolvedValue(true);
    await expect(subscribeToNewsletter({ ...good, email: "not-an-address" })).resolves.toEqual({
      ok: false,
      reason: "invalid-email",
    });
    expect(consumeRateLimit).toHaveBeenCalled();
    expect(insertSubscriber).not.toHaveBeenCalled();
  });

  it("consumes both buckets, not just the first to refuse", async () => {
    // ⚠️ `!callerAllowed || !globalAllowed` would be correct as a decision and
    // wrong as an implementation if the two calls were sequenced by `&&`: the
    // global counter would go unincremented for exactly the callers it exists
    // to bound — the ones already over their per-caller limit.
    consumeRateLimit.mockResolvedValue(false);
    await expect(subscribeToNewsletter(good)).resolves.toEqual({
      ok: false,
      reason: "rate-limited",
    });
    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
  });

  it("skips the per-caller bucket when no proxy gave an identity", async () => {
    // Local dev and the test runner. The global bucket is still consumed.
    await subscribeToNewsletter({ ...good, identity: null });
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit.mock.calls[0][0].identity).toBe("*");
  });

  it("reports `unavailable` without leaking the database's message", async () => {
    // The thrown text can name tables, columns and constraints; none of that
    // belongs in a response to an anonymous caller.
    insertSubscriber.mockRejectedValue(
      new Error('relation "newsletter_subscribers" does not exist')
    );
    await expect(subscribeToNewsletter(good)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
