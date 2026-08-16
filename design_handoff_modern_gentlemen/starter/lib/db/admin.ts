import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client — BYPASSES ROW LEVEL SECURITY.
 *
 * Legitimate callers are narrow and deliberate:
 *   - scheduled ingestion jobs (no user session exists)
 *   - seed and maintenance scripts
 *   - integration-test fixture setup and teardown
 *
 * Everything an editor does goes through lib/db/server.ts instead, under their
 * own session and RLS.
 *
 * Two guards back that up: the runtime browser check below, and the ESLint
 * boundary rule restricting imports to services, API routes, scripts and tests.
 * The `server-only` package would be a stronger, build-time guard, but it
 * throws when imported outside Next — which would break the seed script and
 * integration-test fixtures, both of which legitimately need service-role
 * access with no Next runtime present.
 */
/**
 * Supabase's modern API keys (`sb_secret_…`, `sb_publishable_…`) are **not
 * JWTs**, and the platform rejects them on the `Authorization: Bearer` header —
 * it tries to parse them as a token and answers `Invalid JWT`. They belong on
 * `apikey` alone. The legacy `service_role`/`anon` keys are JWTs and must keep
 * their Bearer, so this is keyed on the format rather than applied to both.
 */
export function isNewFormatKey(key: string): boolean {
  return key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
}

/**
 * Strips the SDK's Bearer fallback for a new-format key.
 *
 * `supabase-js` builds the request headers *before* handing them to whatever
 * `global.fetch` it was given: it sets `apikey`, then sets
 * `Authorization: Bearer <session token ?? the api key>`. For a service-role
 * client there is never a session token, so the fallback is always the key
 * itself — which is exactly what the platform refuses.
 *
 * ⚠️ **The SDK will not do this for us on the REST path.** `supabase-js`
 * 2.111.0 has the guard (`omitApiKeyAsBearer`) and applies it *only* to the
 * Edge Functions fetch; `this.fetch`, which every `.from()` query goes through,
 * gets the Bearer fallback regardless of key format. This was found the
 * expensive way — a `sb_secret_…` key in Railway turned every scheduled-publish
 * run into an HTTP 500.
 *
 * The header is removed only when it carries the key verbatim, so a genuine
 * user token would survive untouched.
 */
function fetchWithoutKeyAsBearer(key: string, base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    return base(input, { ...init, headers });
  };
}

/** Exported for the unit test, which asserts the header rather than the network. */
export function adminFetchFor(key: string, base: typeof fetch = fetch): typeof fetch | undefined {
  return isNewFormatKey(key) ? fetchWithoutKeyAsBearer(key, base) : undefined;
}

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must never run in the browser — it bypasses Row Level Security."
    );
  }

  const key = supabaseServiceRoleKey();

  return createSupabaseClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // `undefined` for a legacy JWT key, so this is a no-op until the project
    // actually moves to a secret key — which is what lets it ship ahead of the
    // rotation rather than alongside it.
    global: { fetch: adminFetchFor(key) },
  });
}
