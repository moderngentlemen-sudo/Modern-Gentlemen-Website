import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/db/public", () => ({
  createPublicClient: () => ({ rpc }),
}));

import { clientIdentity, consumeRateLimit } from "./rateLimit";

/**
 * The limiter's edges, not its arithmetic.
 *
 * The counting itself is one `on conflict do update` in `0026` and is only
 * meaningfully testable against a real Postgres — two concurrent callers is the
 * whole point of it. What is testable here is everything around that statement,
 * and it is where the behaviour that matters lives: which header is trusted,
 * what a failure does, and what a null means.
 */
describe("clientIdentity", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("takes the first entry of x-forwarded-for", () => {
    // A proxy chain appends, so the leftmost entry is what the edge saw. Taking
    // the last would key every request in a chain on the proxy's own address —
    // one bucket for the entire internet.
    expect(clientIdentity(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe(
      "203.0.113.7"
    );
  });

  it("falls back to x-real-ip, which is a single value rather than a list", () => {
    expect(clientIdentity(headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("prefers x-forwarded-for when both are present", () => {
    expect(
      clientIdentity(headers({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" }))
    ).toBe("203.0.113.7");
  });

  it("returns null rather than a shared constant when no proxy set one", () => {
    // ⚠️ The assertion that protects local dev and the E2E suite. A literal
    // fallback — "unknown", or the empty string — would put every visitor
    // without the header into ONE bucket, and the tenth of them would be
    // refused. Null means the caller skips the per-caller bucket entirely.
    expect(clientIdentity(headers({}))).toBeNull();
    expect(clientIdentity(headers({ "x-forwarded-for": "" }))).toBeNull();
    expect(clientIdentity(headers({ "x-forwarded-for": "   " }))).toBeNull();
  });
});

describe("consumeRateLimit", () => {
  const call = () =>
    consumeRateLimit({
      scope: "newsletter",
      identity: "203.0.113.7",
      limit: 3,
      windowSeconds: 600,
    });

  beforeEach(() => {
    rpc.mockReset();
  });

  it("allows when the function says so and refuses when it says not", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(call()).resolves.toBe(true);

    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(call()).resolves.toBe(false);
  });

  it("hashes the identity, so no address reaches the table", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await call();

    const key = rpc.mock.calls[0][1].p_key as string;
    expect(key).not.toContain("203.0.113.7");
    expect(key).toMatch(/^newsletter:[0-9a-f]{32}$/);
  });

  it("keys different scopes and identities separately", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await consumeRateLimit({ scope: "a", identity: "x", limit: 1, windowSeconds: 60 });
    await consumeRateLimit({ scope: "b", identity: "x", limit: 1, windowSeconds: 60 });
    await consumeRateLimit({ scope: "a", identity: "y", limit: 1, windowSeconds: 60 });

    const keys = rpc.mock.calls.map((c) => c[1].p_key);
    expect(new Set(keys).size).toBe(3);
  });

  it("sends the window as a Postgres interval literal", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await call();
    expect(rpc.mock.calls[0][1].p_window).toBe("600 seconds");
  });

  it("fails OPEN on a transport error, and on a null answer", async () => {
    // ⚠️ Deliberate, and the same choice the SQL makes in its own exception
    // block. This limiter guards a newsletter sign-up: if the counter is broken,
    // refusing every visitor is worse than briefly not limiting. A null `data`
    // is a transport-level problem too — it is NOT a refusal, and reading it as
    // one would close the form the moment PostgREST hiccupped.
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(call()).resolves.toBe(true);

    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(call()).resolves.toBe(true);

    rpc.mockRejectedValueOnce(new Error("network"));
    await expect(call()).resolves.toBe(true);
  });
});
