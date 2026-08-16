import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";
import { fetchForKey } from "./apiKey";

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
    // rotation rather than alongside it. See ./apiKey for why it is needed.
    global: { fetch: fetchForKey(key) },
  });
}
