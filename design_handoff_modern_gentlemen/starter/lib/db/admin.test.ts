/**
 * The Bearer-header rule for Supabase's modern API keys.
 *
 * This is asserted here rather than left to the integration suite because the
 * failure it prevents is a *production* one that no local run reproduces: the
 * key format only changes when someone edits Railway, and the symptom is an
 * HTTP 500 from `/api/jobs/publish-scheduled` with nothing failing anywhere
 * else. It cost exactly that once — a `sb_secret_…` key went into Railway and
 * every scheduled-publish tick started returning 500.
 *
 * The headers are the whole behaviour, so a fake `fetch` captures them and no
 * network is involved.
 */

import { describe, expect, it } from "vitest";

import { adminFetchFor, isNewFormatKey } from "./admin";

const LEGACY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
const SECRET_KEY = "sb_secret_EXAMPLE_NOT_A_REAL_KEY";

/** Captures the headers the wrapper passes through, and answers 200. */
function captureFetch(): { calls: Headers[]; fetch: typeof fetch } {
  const calls: Headers[] = [];
  const fake: typeof fetch = async (_input, init) => {
    calls.push(new Headers(init?.headers));
    return new Response(null, { status: 200 });
  };
  return { calls, fetch: fake };
}

describe("isNewFormatKey", () => {
  it("recognises both modern key prefixes", () => {
    expect(isNewFormatKey(SECRET_KEY)).toBe(true);
    expect(isNewFormatKey("sb_publishable_abc")).toBe(true);
  });

  it("does not claim a legacy JWT", () => {
    // The legacy service_role and anon keys are JWTs and *must* keep their
    // Bearer header — treating one as a modern key would break the client that
    // works today.
    expect(isNewFormatKey(LEGACY_JWT)).toBe(false);
  });
});

describe("adminFetchFor", () => {
  it("returns undefined for a legacy key, leaving the SDK untouched", () => {
    // This is what lets the fix ship *before* the key rotation: with today's
    // legacy key in Railway it changes nothing at all.
    expect(adminFetchFor(LEGACY_JWT)).toBeUndefined();
  });

  it("drops the Authorization header when it carries a modern key", async () => {
    const { calls, fetch: base } = captureFetch();
    const wrapped = adminFetchFor(SECRET_KEY, base)!;

    // Exactly what supabase-js hands its `global.fetch`: it sets `apikey` and
    // then falls back to the key as a Bearer token when there is no session,
    // which for a service-role client is always.
    await wrapped("https://example.test/rest/v1/pages", {
      headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` },
    });

    expect(calls[0].has("Authorization"), "the platform rejects this as Invalid JWT").toBe(false);
    expect(calls[0].get("apikey"), "and the key still has to arrive").toBe(SECRET_KEY);
  });

  it("leaves a real user token alone", async () => {
    const { calls, fetch: base } = captureFetch();
    const wrapped = adminFetchFor(SECRET_KEY, base)!;

    // Only the verbatim key is stripped. A session token is somebody's
    // identity, and removing it would silently escalate the request to the
    // key's own privileges.
    await wrapped("https://example.test/rest/v1/pages", {
      headers: { apikey: SECRET_KEY, Authorization: "Bearer a.user.token" },
    });

    expect(calls[0].get("Authorization")).toBe("Bearer a.user.token");
  });
});
