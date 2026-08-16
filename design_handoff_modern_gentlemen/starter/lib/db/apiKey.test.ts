/**
 * The Bearer-header rule for Supabase's modern API keys.
 *
 * Asserted here rather than in the integration suite because the failure only
 * appears when someone edits a deployment variable, and no local or CI run
 * reproduces it: CI's keys come from the throwaway local stack and are legacy
 * JWTs. It cost a production incident once — a `sb_secret_…` key in Railway
 * turned every scheduled-publish tick into an HTTP 500.
 *
 * The headers are the whole behaviour, so a fake `fetch` captures them and no
 * network is involved.
 */

import { describe, expect, it } from "vitest";

import { fetchForKey, isNewFormatKey } from "./apiKey";

const LEGACY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
const SECRET_KEY = "sb_secret_EXAMPLE_NOT_A_REAL_KEY";
const PUBLISHABLE_KEY = "sb_publishable_EXAMPLE_NOT_A_REAL_KEY";

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
    expect(isNewFormatKey(PUBLISHABLE_KEY)).toBe(true);
  });

  it("does not claim a legacy JWT", () => {
    // The legacy service_role and anon keys are JWTs and *must* keep their
    // Bearer header — treating one as a modern key would break the clients that
    // work today.
    expect(isNewFormatKey(LEGACY_JWT)).toBe(false);
  });
});

describe("fetchForKey", () => {
  it("returns undefined for a legacy key, leaving the SDK untouched", () => {
    // This is what lets the fix ship *before* any key swap: with today's legacy
    // keys in Railway it changes nothing at all, in any of the four clients.
    expect(fetchForKey(LEGACY_JWT)).toBeUndefined();
  });

  it.each([
    ["secret", SECRET_KEY],
    ["publishable", PUBLISHABLE_KEY],
  ])("drops the Authorization header carrying a %s key", async (_label, key) => {
    const { calls, fetch: base } = captureFetch();
    const wrapped = fetchForKey(key, base)!;

    // Exactly what supabase-js hands its `global.fetch`: it sets `apikey`, then
    // falls back to the key as a Bearer token when there is no session — which
    // for the admin client is always, and for the public clients is every
    // signed-out visitor.
    await wrapped("https://example.test/rest/v1/pages", {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    expect(calls[0].has("Authorization"), "the platform rejects this as Invalid JWT").toBe(false);
    expect(calls[0].get("apikey"), "and the key still has to arrive").toBe(key);
  });

  it("leaves a real user token alone", async () => {
    const { calls, fetch: base } = captureFetch();
    const wrapped = fetchForKey(PUBLISHABLE_KEY, base)!;

    // Only the verbatim key is stripped. A session token is somebody's
    // identity, and removing it would silently downgrade the request from the
    // signed-in editor to anonymous — which RLS would then answer differently.
    await wrapped("https://example.test/rest/v1/pages", {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer a.user.token" },
    });

    expect(calls[0].get("Authorization")).toBe("Bearer a.user.token");
  });
});
